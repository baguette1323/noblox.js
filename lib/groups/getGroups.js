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
        const [groupRolesResponse, primaryGroupResponse] = await Promise.all([
            constructRequest(`https://groups.roblox.com/v2/users/${userId}/groups/roles`),
            constructRequest(`https://groups.roblox.com/v1/users/${userId}/groups/primary/role`)
        ]);

        const groupRoleData = groupRolesResponse.body?.data;
        if (!groupRoleData || groupRolesResponse.statusCode !== 200) {
            const errorMessages = groupRolesResponse.body?.errors?.map((e) => e.message).join(', ') || 'Unknown error';
            throw new Error(`${groupRolesResponse.statusCode} ${errorMessages}`);
        }

        const primaryGroupId = primaryGroupResponse.body?.group?.id;
        const groupIds = groupRoleData.map((data) => data.group.id).join(',');
        const [groupOwners, groupThumbnails] = await Promise.all([
            constructRequest(`https://groups.roblox.com/v2/groups?groupIds=${groupIds}`),
            constructRequest(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds}&size=150x150&format=Png&isCircular=false`)
        ]);

        const groupOwnersData = groupOwners.body?.data || [];
        const groupThumbnailsData = groupThumbnails.body?.data || [];

        return groupRoleData.map((data) => {
            const groupOwnerData = groupOwnersData.find((group) => group.id === data.group.id);
            const thumbnailData = groupThumbnailsData.find((thumbnail) => thumbnail.targetId === data.group.id);

            return {
                Id: data.group.id,
                Name: data.group.name,
                OwnerId: groupOwnerData?.owner?.id || null,
                MemberCount: data.group.memberCount,
                IsPrimary: data.group.id === primaryGroupId,
                Rank: data.role.rank,
                Role: data.role.name,
                RoleId: data.role.id,
                EmblemUrl: thumbnailData?.imageUrl || null,
            };
        });
    } catch (error) {
        throw error;
    }
}

exports.func = function (args) {
    return getGroups(args.userId);
};
