const configDefaults = {
   apiHost: 'app.rightbrain.ai',
   authHost: 'oauth.rightbrain.ai',
   clientID: null,
   clientSecret: null,
}


function NewAuthClient(authHost) {
    return new AuthClient(authHost)
}

function NewTasksClient(userConfig) {
    config = {...configDefaults, ...userConfig}
    authClient = NewAuthClient(config.authHost, config.clientID, config.clientSecret)
    return new TasksClient(authClient, config.apiHost)
}

 class AuthClient {
    constructor(authHost, clientID, clientSecret) {
       this.authHost = authHost
       this.clientID = clientID
       this.clientSecret = clientSecret
    }
    async CreateToken() {
       const res = await fetch(`https://${this.authHost}/oauth2/token`, {
          method: 'POST',
          headers: {
             Authorization: `Basic ${this.GetBasicAuthorizationHeader(this.clientID, this.clientSecret)}`
          },
          body: this.GetFormDataWithGrantType('client_credentials')
       })
       if (res.status !== 200) {
          throw new Error(
             `cannot create token, expected 200 but got ${res.status}: ${res.statusText}`
          )
       }
       const data = await res.json()
       if (!data.access_token) {
          throw new Error(
             `cannot create token, expected response to contain access token`
          )
       }
       return data.access_token
    }
    GetBasicAuthorizationHeader(clientID, clientSecret) {
       return btoa(`${clientID}:${clientSecret}`)
    }
    GetFormDataWithGrantType(grantType) {
       const formData = new FormData()
       formData.append('grant_type', grantType)
       return formData
    }
 }
 
 class TasksClient {
    constructor(authClient, apiHost) {
       this.authClient = authClient
       this.apiHost = apiHost
    }
    async Create(definition) {
      const accessToken = await this.authClient.CreateToken()
      const response = await fetch(await this.getTaskCreateURL(accessToken), {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
         },
         body: JSON.stringify(definition)
      })
      if (response.status !== 200) {
         throw new Error(
            `Error creating Task, expected status code of 200, but got ${response.status}: ${response.statusText}`
         )
      }
      return await response.json()
    }
    async Run(taskID, taskInput, taskRevision) {
       const data = JSON.stringify(taskInput)
       this.assertTaskInputSize(data)
       const accessToken = await this.authClient.CreateToken()
       const response = await fetch(await this.getTaskRunURL(accessToken, taskID, taskRevision), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: this.getTaskInputFormData(data)
       })
       if (response.status !== 200) {
          throw new Error(
             `Error running Task, expected status code of 200, but got ${response.status}: ${response.statusText}`
          )
       }
       return await response.json()
    }
    async getTaskCreateURL(accessToken) {
      const clientDetails = await this.getClientDetails(accessToken)
      return `https://${this.apiHost}/api/v1/org/${clientDetails.org_id}/project/${clientDetails.project_id}/task`
   }
    async getTaskRunURL(accessToken, taskID, taskRevision) {
       const clientDetails = await this.getClientDetails(accessToken)
       let url = `https://${this.apiHost}/api/v1/org/${clientDetails.org_id}/project/${clientDetails.project_id}/task/${taskID}/run`
       if (taskRevision) {
          url += `?revision=${taskRevision}`
       }
       return url
    }
    assertTaskInputSize(taskInput) {
       if (taskInput.length > 128000) {
          throw new Error(`Error running task, max task input is 128,000 but input was ${taskInput.length}`)
       }
    }
    getTaskInputFormData(taskInput) {
       const formData = new FormData()
       formData.append('task_input', taskInput)
       return formData
    }
    async getClientDetails(accessToken) {
       if (!accessToken) {
          throw new Error(
             `Error running task, cannot get client details, expected access token to not be empty`
          )
       }
       const res = await fetch(`https://${this.apiHost}/api/v1/whoami`, {
          method: 'GET',
          headers: {
             Authorization: `Bearer ${accessToken}`
          }
       })
       if (res.status !== 200) {
          throw new Error(
             `Error running task, cannot get client details, expected 200 but got ${res.status}: ${res.statusText}`
          )
       }
       const details = await res.json()
       if (!details.client) {
          throw new Error(
             `Error running task, cannot get client details, expected response to contain client details`
          )
       }
       return details.client
    }
 }
 module.exports = {
    NewTasksClient,
    NewAuthClient
 }