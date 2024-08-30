const http = require('../util/http.js').func

exports.required = ['userId']
exports.optional = []

function getGroups(userId) {
  return new Promise((resolve, reject) => {
    const requests = [
      constructRequest(`//groups.roblox.com/v2/users/${userId}/groups/roles`),
      constructRequest(`//groups.roblox.com/v1/users/${userId}/groups/primary/role`)
    ].map(promise => promise.then(
      val => ({ status: 'fulfilled', value: val }),
      rej => ({ status: 'rejected', reason: rej })
    ))

    const result = []

    Promise.all(requests).then(async (promiseResponses) => {
      let responses = promiseResponses.map(response => response.value)
      const failedResponse = (responses[0].statusCode !== 200 || !responses[0].body)

      if (failedResponse) {
        const body = responses[0].body || {}
        if (body.errors && body.errors.length > 0) {
          const errors = body.errors.map((e) => e.message)
          return reject(new Error(`${responses[0].statusCode} ${errors.join(', ')}`))
        }
        return reject(new Error('The provided user ID is not valid.'))
      }

      responses = responses.map(r => r.body)

      const groupRoleData = responses[0].data
      if (groupRoleData) {
        const primaryGroupId = responses[1]?.group?.id

        const groupOwners = await constructRequest(`https://groups.roblox.com/v2/groups?groupIds=${groupRoleData.map(data => data.group.id).join(',')}`)
        const groupThumbnails = await constructRequest(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupRoleData.map(data => data.group.id).join(',')}&size=150x150&format=Png&isCircular=false`)

        groupRoleData.forEach(data => {
          const groupOwnerData = groupOwners.body.data.find(group => group.id === data.group.id)
          const thumbnailData = groupThumbnails.body.data.find(thumbnail => thumbnail.targetId === data.group.id)

          const insertion = {
            Id: data.group.id,
            Name: data.group.name,
            OwnerId: groupOwnerData ? groupOwnerData.owner.id : null,  // Handle the case where groupOwnerData is null
            MemberCount: data.group.memberCount,
            IsPrimary: data.group.id === primaryGroupId,
            Rank: data.role.rank,
            Role: data.role.name,
            RoleId: data.role.id,
            EmblemUrl: thumbnailData ? thumbnailData.imageUrl : null  // Handle the case where thumbnailData is null
          }
          result.push(insertion)
        })
      }

      resolve(result)
    }).catch(reject)
  })
}

function constructRequest(url) {
  return http({
    url,
    options: {
      resolveWithFullResponse: true,
      followRedirect: false,
      json: true
    }
  })
}

exports.func = function(args) {
  return getGroups(args.userId)
}
