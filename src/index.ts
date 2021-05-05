import express, { Request, Response } from 'express'
import { AuthorizationCode } from 'simple-oauth2'
const request = require('superagent')
import cookieSession from 'cookie-session'
import dotenv from 'dotenv'
dotenv.config()

const clientId: string|undefined = process.env.CLIENT_ID
const clientSecret: string|undefined = process.env.CLIENT_SECRET
const serverToken: string|undefined = process.env.SERVER_TOKEN

const gvmsBaseUrl: string = 'https://test-api.service.hmrc.gov.uk/'
const serviceName = 'customs/goods-movement-system'
const serviceVersion = '1.0'
const oauthScope: string = 'write:goods-movement-system'

const redirectUri = 'http://localhost:8080/oauth20/callback'
// const redirectUri = 'https://test-gvms.herokuapp.com/oauth20/callback'

const PORT: string|number = process.env.PORT || 8080

const app = express()

app.use(
    cookieSession({
      name: 'session',
      keys: ['oauth2Token', 'caller'],
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
    })
)

const client = new AuthorizationCode({
    client: {
      // @ts-ignore  
      id: clientId,
      // @ts-ignore
      secret: clientSecret,
    },
    auth: {
      tokenHost: gvmsBaseUrl,
      tokenPath: '/oauth/token',
      authorizePath: '/oauth/authorize',
    },
  })

const authorizationUri = client.authorizeURL({
    redirect_uri: redirectUri,
    scope: oauthScope,
})

app.get('/', (req: any, res: Response) => {
    try {
        let accessToken = client.createToken(req.session.oauth2Token)
        console.log(accessToken)

        const routes = {
            "GET GMR LIST" : "http://localhost:8080/get-GMR-list",
            "CREATE GMR" : "http://localhost:8080/create-GMR",
            "GET GMR BY ID" : "http://localhost:8080/get-gmr-by-id/:gmrId",
            "UPDATE GMR BY ID" : "http://localhost:8080/update-gmr-by-id/:gmrId",
            "DELETE GMR BY ID" : "http://localhost:8080/delete-gmr-by-id/:gmrId",
            "GET REFERENCE DATA" : "http://localhost:8080/delete-gmr-by-id/"
        }

        res.status(200).json({routes, accessToken})
    } catch (error) {
        req.session.caller = '/get-GMR-list'
        res.redirect(authorizationUri)
    }
})

app.get('/get-GMR-list', (req: any, res: Response) => {
    if (req.session.oauth2Token) {
        let accessToken = client.createToken(req.session.oauth2Token)
        console.log(accessToken)

        callApi({
            endpoint: '/movements',
            method: 'get', 
            res, 
            bearerToken: accessToken.token.access_token
        })
    } else {
        req.session.caller = '/get-GMR-list'
        res.redirect(authorizationUri)
    }
})

app.get('/create-GMR', (req: any, res: Response) => {
    if (req.session.oauth2Token) {
        let accessToken = client.createToken(req.session.oauth2Token)
        console.log('Request Successful ',accessToken)

        const data = {
            "direction": "GB_TO_NI",
            "isUnaccompanied": false,
            "vehicleRegNum": "TEST DEF",
            "plannedCrossing": {
              "routeId": "1",
              "localDateTimeOfDeparture": "2021-08-11T10:58"
            },
            "customsDeclarations": [
              {
                "customsDeclarationId": "0GB689223596000-SE119404",
                "sAndSMasterRefNum": "20GB01I0XLM976S001"
              }, {
                "customsDeclarationId": "0GB689223596000-SE119405",
                "sAndSMasterRefNum": "20GB01I0XLM976S002"
              }
            ],
            "transitDeclarations": [
              {
                "transitDeclarationId": "10GB00002910B75BE5",
                "isTSAD": true
              }, {
                "transitDeclarationId": "10GB00002910B75BE6",
                "sAndSMasterRefNum": "20GB01I0XLM976S004",
                "isTSAD": false
              }
            ]
        }

        callApi({
            endpoint: '/movements',
            method: 'post', 
            res, 
            bearerToken: accessToken.token.access_token,
            data: data
        })

        console.log('POST Request Successful ')
    } else {
        req.session.caller = '/get-GMR-list'
        res.redirect(authorizationUri)
    }
})

app.get('/oauth20/callback', async (req: any, res: Response) => {
    const { code } = req.query
    const options = {
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }
  
    try {
    // @ts-ignore
      const accessToken = await client.getToken(options)
      req.session.oauth2Token = accessToken
      return res.redirect(req.session.caller)
    } catch (error) {
      return res.status(500).json('Authentication failed')
    }
})

// endpoint: any, res: any, bearerToken: any, method = 'get', data: any
const callApi = (params:any) => {
    const acceptHeader = `application/vnd.hmrc.${serviceVersion}+json`
    const url = gvmsBaseUrl + serviceName + params.endpoint

    const req = request[params.method](url).accept(acceptHeader)
    if (params.bearerToken) {
        req.set('Authorization', `Bearer ${params.bearerToken}`)
    }

    if (params.method === 'post' && params.data !== undefined) {
        req.send(params.data)
    }

    req.end((err: any, apiResponse: any) => handleResponse(params.res, err, apiResponse))
}

function handleResponse(res: any, err: any, apiResponse: any) {
    if (err || !apiResponse.ok) {
      res.send(err)
    } else {
      res.send(apiResponse.body)
    }
}



app.listen(PORT, () => {
    console.log('Started at http://localhost:8080')
})



