const http = require('../util/http.js').func;

exports.required = ['userId'];
exports.optional = [];

async function constructRequest(url, maxRetries = 3, initialDelay = 3000) {
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const response = await http({
                url,
                options: {
                    resolveWithFullResponse: true,
                    followRedirect: false,
                    json: true,
                },
			});

            if (response.statusCode === 429) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.warn(`Ratelimit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (err) {
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.warn(`Error occurred, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw err;
            }
        }
    }

    throw new Error('Maximum retries exceeded. Please try again in a minute or two!');
}

async function getGroups(userId) {
    try {
        const groupRolesResponse = await constructRequest(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const groupRoleData = groupRolesResponse.body?.data;

        if (!groupRoleData || groupRolesResponse.statusCode !== 200) {
            const errorMessages = groupRolesResponse.body?.errors?.map((e) => e.message).join(', ') || 'Unknown error';
            throw new Error(`${groupRolesResponse.statusCode} ${errorMessages}`);
        }

        const groupIds = groupRoleData.map((data) => data.group.id).join(',');

        const groupThumbnails = await constructRequest(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds}&size=150x150&format=Png&isCircular=false`);
        const groupThumbnailsData = groupThumbnails.body?.data || [];

        return groupRoleData.map((data) => {
            const thumbnailData = groupThumbnailsData.find((thumbnail) => thumbnail.targetId === data.group.id);

            return {
                Id: data.group.id,
				Name: data.group.name,
				Description: data.group.description || null,
                MemberCount: data.group.memberCount,
                Rank: data.role.rank,
                Role: data.role.name,
                RoleId: data.role.id,
				EmblemUrl: thumbnailData?.imageUrl || null,
				Shout: {
                    Body: data.group.shout?.body || null,
                    Poster: {
                        UserId: data.group.shout?.poster?.userId || null,
                        Username: data.group.shout?.poster?.username || null,
                        DisplayName: data.group.shout?.poster?.displayName || null,
                        BuildersClubMembershipType: data.group.shout?.poster?.buildersClubMembershipType || null,
                        HasVerifiedBadge: data.group.shout?.poster?.hasVerifiedBadge || false,
                    },
                    Created: data.group.shout?.created || null,
                    Updated: data.group.shout?.updated || null,
                },
                Owner: {
                    UserId: data.group.owner?.userId || null,
                    Username: data.group.owner?.username || null,
                    DisplayName: data.group.owner?.displayName || null,
                    BuildersClubMembershipType: data.group.owner?.buildersClubMembershipType || null,
                    HasVerifiedBadge: data.group.owner?.hasVerifiedBadge || false,
                },
                IsBuildersClubOnly: data.group.isBuildersClubOnly || false,
                PublicEntryAllowed: data.group.publicEntryAllowed || false,
                IsLocked: data.group.isLocked || false,
                HasVerifiedBadge: data.group.hasVerifiedBadge || false,
				IsNotificationsEnabled: data.isNotificationsEnabled || false,
				IsPrimary: data.isPrimaryGroup || false
            };
        });
    } catch (error) {
        throw error;
    }
}

exports.func = function (args) {
    return getGroups(args.userId);
};
