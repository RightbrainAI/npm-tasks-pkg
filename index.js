function NewAuthClient(tokenURL) {
    return new AuthClient(tokenURL)
}

function NewTasksClient(apiHost, accessToken) {
    return new TasksClient(apiHost, accessToken)
}

 class AuthClient {
    constructor(tokenURL) {
       this.tokenURL = tokenURL
    }
    async CreateToken(clientId, clientSecret) {
       const res = await fetch(this.tokenURL, {
          method: 'POST',
          headers: {
             Authorization: `Basic ${this.GetBasicAuthorizationHeader(clientId, clientSecret)}`
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
    GetBasicAuthorizationHeader(clientId, clientSecret) {
       return btoa(`${clientId}:${clientSecret}`)
    }
    GetFormDataWithGrantType(grantType) {
       const formData = new FormData()
       formData.append('grant_type', grantType)
       return formData
    }
 }
 
 class TasksClient {
    constructor(apiHost, accessToken) {
       this.apiHost = apiHost
       this.accessToken = accessToken
    }
    async Create(definition) {
      const response = await fetch(await this.getTaskCreateURL(), {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`
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
       const response = await fetch(await this.getTaskRunURL(taskID, taskRevision), {
          method: 'POST',
          headers: {
             Authorization: `Bearer ${this.accessToken}`
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
    async getTaskCreateURL() {
      const clientDetails = await this.getClientDetails(this.accessToken)
      return `https://${this.apiHost}/api/v1/org/${clientDetails.org_id}/project/${clientDetails.project_id}/task`
   }
    async getTaskRunURL(taskID, taskRevision) {
       const clientDetails = await this.getClientDetails(this.accessToken)
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
       const res = await fetch(this.getAPIWhoAmIURL(this.apiHost), {
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
    getAPIWhoAmIURL(host) {
       return `https://${host}/api/v1/whoami`
    }
 }
 module.exports = {
    NewTasksClient,
    NewAuthClient
 }