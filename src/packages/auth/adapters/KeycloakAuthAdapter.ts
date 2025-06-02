import fetch from 'node-fetch';
import type { AuthAdapter, ValidateResponse } from '../../../types/auth.js';

import { Request, Response } from 'express';
import { getEnv } from '../../../env.js';

export const KeycloakAuthAdapter: AuthAdapter = {
  logout: async (req: Request): Promise<boolean | string> => {

    // stored earlier during login
    const refreshToken = req.cookies['refresh_token']; 
  	const id_token = req.cookies['id_token'] ?? "";


    const { KEYCLOAK_CLIENT_SECRET } = getEnv();
    
    // revoke the refresh token (if present)
    if (refreshToken) {
      const refreshRevokeResponse = await fetch('https://keycloak.shared-services.appdat.jsc.nasa.gov/auth/realms/ssmo-dev/protocol/openid-connect/logout', {
        body: new URLSearchParams({
          client_id: 'ssmo-dev-shared-aerie',
          client_secret: KEYCLOAK_CLIENT_SECRET, // required for confidential clients
          refresh_token: refreshToken
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST'
      });

      console.log(refreshRevokeResponse);
    }

    // redirect browser to Keycloak logout page (SSO session destroy)
    const keycloakLogoutUrl = new URL(
      'https://keycloak.shared-services.appdat.jsc.nasa.gov/auth/realms/ssmo-dev/protocol/openid-connect/logout'
    );

    keycloakLogoutUrl.searchParams.set('post_logout_redirect_uri', 'http://localhost:3000/plans');
    keycloakLogoutUrl.searchParams.set('id_token_hint', id_token);

    // return a string for the redirect URL...
    return keycloakLogoutUrl.toString();
  },

  validate: async (req: Request, res: Response): Promise<ValidateResponse> => {
    // validation is performed by just token expiration. 
    // keycloak doesn't necessarily to need/use a validate endpoint; validation handled by the request/expiration;
    //    -> validate is a bit of a misnomer
    const access_token = req.cookies["access_token"];
    const refresh_token = req.cookies["refresh_token"];
    const id_token = req.cookies["id_token"]; // necessary for logout
    
    const { KEYCLOAK_CLIENT_SECRET } = getEnv();

    // 4 CASES:

    // 1. Authorization Code only
    //    FIRST: handle getting redirected from redirect_uri, as the 'callback route', entirely here, case 2.
    //    If NOT:
    //      - make a request to Keycloak token endpoint
    //      - save access token & refresh token
    //      - return, don't set validationData.redirectURL but set validationData.success = true
    //    If SO:
    //      - clear the cookies
    //      - set validationData.redirectURI to the referrer (UI)
    //        -> doing so hits hooks.server.ts, then we will hit the no cookies case
    if (req.url.includes("code=")) {
        const auth_code = req.url.split("code=")[1].split("?")[0];
        const tokenResponse = await fetch(
            'https://keycloak.shared-services.appdat.jsc.nasa.gov/auth/realms/ssmo-dev/protocol/openid-connect/token',
            {
                body: new URLSearchParams({
                    client_id: 'ssmo-dev-shared-aerie',
                    client_secret: KEYCLOAK_CLIENT_SECRET,
                    code: auth_code,
                    grant_type: 'authorization_code',
                    redirect_uri: 'http://localhost:9000/auth/validateSSO'
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST'
            }
        );
    
        const tokens: any = await tokenResponse.json();
    
        if (!tokens.access_token) {
            // TODO: clear all tokens, like the else case
            return {
                message: 'invalid access token',
                redirectURL: 'http://localhost:9000/auth/validateSSO', 
                success: false
            };
        }
    
        // Save the token in a secure, HttpOnly cookie
        res.cookie('access_token', tokens.access_token, {
            maxAge: tokens.expires_in * 1000, // for the access token, but id token assumed has the same expiry. Default of 5 min
            path: '/',
            sameSite: 'none',
            secure: false // TODO: Set to true in production, when https being used else it fails, should do "process.env.NODE_ENV === 'production'"
        });
        res.cookie('refresh_token', tokens.refresh_token, { 
            maxAge: tokens.refresh_expires_in * 1000,
            path: '/', 
            sameSite: 'none',
            secure: false
        }); // simpler ver.
        res.cookie('id_token', tokens.id_token, { 
            maxAge: tokens.expires_in * 1000,
            path: '/', 
            sameSite: 'none',
            secure: false
        });
    
        return {
            message: 'FORWARD TO PLANS',
            redirectURL: '',
            success: true,
            token: tokens.access_token,
            // don't send a userId; hooks.server.ts already parses the token, so we will pull the username out there.
            //    to get it here, would need to call decodeJwt or run a call to /userinfo
        };
    }

    // 2. No Cookies
    //    Make a request to get an authorization code, with the redirect_uri set to be just aerie-ui
    //     -> doing so will hit hooks.server.ts and forward us here to case 2
    else if (!access_token && !refresh_token) {
      const keycloakAuthUrl = new URL(
        'https://keycloak.shared-services.appdat.jsc.nasa.gov/auth/realms/ssmo-dev/protocol/openid-connect/auth'
      );
      keycloakAuthUrl.searchParams.set('client_id', 'ssmo-dev-shared-aerie');
      keycloakAuthUrl.searchParams.set('response_type', 'code');
      keycloakAuthUrl.searchParams.set('scope', 'openid profile email');
      keycloakAuthUrl.searchParams.set('redirect_uri', 'http://localhost:9000/auth/validateSSO'); // TODO: turn this into an env variable or something
  
      console.log('throwing redirect to keycloak...');

      return {
        message: 'REDIRECT',
        redirectURL: keycloakAuthUrl.toString(),
        success: false
      }
    }

    // 3. Refresh Token present, Access Token not present
    //      -> We are trying here two sub-cases. This is a slightly contrived way to get all refresh token logic on the gateway server,
    //          instead of having any on the actual UI server. The problem is that, unlike the auth code flow, there is no redirect logic
    //          for refresh tokens. It's expected the app just grabs tokens directly. But cookies can't get set on a fetch...I mean they can,
    //          but we would have to set our fetch credentials to 'same-origin' in this case, and then mess a bit with the interface of 
    //          hooks.server.ts to save cookies on the frontend. That would be a valid solution and may warrant some rewriting of this code. 
    //          However, if changes are to be AS minimal as possible, we need our contrived solution...
    //      -> The solution:
    //          - CASE 1:
    //              = simply fail and return a redirect url to here, with a little searchparam added saying that we should hit case 2 on redirect
    //          - CASE 2:
    //              = make the request to get tokens
    //              = SET COOKIES
    //              = redirect back to plans (return "FORWARD TO PLANS")
    else if (refresh_token && !access_token) {
        if (req.url.includes("refresh_settable")) { // value doesn't even matter
            const refresh_token_resp = await fetch('https://keycloak.shared-services.appdat.jsc.nasa.gov/auth/realms/ssmo-dev/protocol/openid-connect/token', {
                body: new URLSearchParams({
                    client_id: 'ssmo-dev-shared-aerie',
                    client_secret: KEYCLOAK_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    redirect_uri: 'http://localhost:9000/auth/validateSSO',
                    refresh_token: refresh_token,
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST',
            });

		    if (refresh_token_resp.ok) {
			    const tokens: any = await refresh_token_resp.json();
      
                console.log("PARSED, USING EXISTING REFRESH TOKEN", tokens)

                // now we have an access token!
                res.cookie('access_token', tokens.access_token, {
                    maxAge: tokens.expires_in * 1000, // for the access token, but id token assumed has the same expiry. Default of 5 min
                    path: '/',
                    sameSite: 'none',
                    secure: false // TODO: set this to a variable that changes if prod is true/false
                });

                res.cookie('id_token', tokens.id_token, {
                    maxAge: tokens.expires_in * 1000, // for the access token, but id token assumed has the same expiry. Default of 5 min
                    path: '/',
                    sameSite: 'none',
                    secure: false // TODO: set this to a variable that changes if prod is true/false
                });
            
                // optionally refresh the refresh token (rotation)
                if (tokens.refresh_token) {
                    res.cookie('refresh_token', tokens.refresh_token, {
                        maxAge: tokens.refresh_expires_in * 1000, // 30 minutes
                        // NOTE: set to 30 minutes, which is short...could preemptively refresh it, to prevent unexpected logout, but unexpected logout seems fine...
                        path: '/',
                        sameSite: 'none',
                        secure: false // TODO: set this to a variable that changes if prod is true/false
                    });
                }

                return {
                    message: 'FORWARD TO PLANS',
                    redirectURL: '',
                    success: true,
                    token: tokens.access_token,
                    // don't send a userId; hooks.server.ts already parses the token, so we will pull the username out there.
                    //    to get it here, would need to call decodeJwt or run a call to /userinfo
                };
            }  
            else {
                // Refresh token most likely outdated
                // Clear all tokens...
                res.cookie('access_token', '', {
                    // httpOnly: true,
                    maxAge: 0, // expire immediately
                    path: '/',
                });
                res.cookie('id_token', '', {
                    // httpOnly: true,
                    maxAge: 0, // expire immediately
                    path: '/',
                });
                res.cookie('refresh_token', '', {
                    // httpOnly: true,
                    maxAge: 0, // expire immediately
                    path: '/',
                });

                // ...then return to plans
                return {
                    message: 'FORWARD TO PLANS',
                    redirectURL: '',
                    success: false
                };
            }
        }
        else { // CASE 1
            const refresh_route = new URL(
                'http://localhost:9000/auth/validateSSO'
            );
            refresh_route.searchParams.set('refresh_settable', 'true');
            return {
                message: 'REDIRECT',
                redirectURL: refresh_route.toString(),
                success: false
            }
        }
    }

    // 4. Refresh Token and Access Token present
    //    Check expiry.
    //    IF NOT:
    //      - set validation.success = true
    //      - return
    //      NOTE: this assumes that decoding the token will correctly get roles. it SHOULD, but if not, will need to hit userinfo here too, and then the re-ping to here from routes 2 and 3 become absolutely necessary.
    //    IF SO:
    //      - clear the cookies
    //      - set validationData.redirectURI to the referrer (UI)
    //        -> doing so hits hooks.server.ts, then we will hit the no cookies case
    else if (access_token && refresh_token && id_token) {
        return {
            message: 'valid access token',
            redirectURL: '',
            success: true,
            token: access_token,
            // don't send a userId; hooks.server.ts already parses the token, so we will pull the username out there.
            //    to get it here, would need to call decodeJwt or run a call to /userinfo
        };
    }

    // otherwise we have neither or are missing something crucial; 
    //    we should just clear tokens in case...doing so requires a redirect
    else { 
        // we have been redirected here, so we CAN clear cookies
        if (req.url.includes("clear")) {
            res.cookie('access_token', '', {
                maxAge: 0, // expire immediately
                path: '/',
            });
            res.cookie('id_token', '', {
                maxAge: 0, // expire immediately
                path: '/',
            });
            res.cookie('refresh_token', '', {
                maxAge: 0, // expire immediately
                path: '/',
            });

            // ...then return to plans
            return {
                message: 'FORWARD TO PLANS',
                redirectURL: '',
                success: false
            };
        }
        else { // set up TO redirect here to clear cookies
            console.log("REAUTHENTICATING BC TIMEOUT");
            const refresh_route = new URL(
                'http://localhost:9000/auth/validateSSO'
            );
            refresh_route.searchParams.set('clear', 'true');
            return {
                message: 'REDIRECT',
                redirectURL: refresh_route.toString(),
                success: false
            }
        }
    }
  },
};
