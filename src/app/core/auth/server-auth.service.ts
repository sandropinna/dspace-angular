import { filter, map, switchMap, take } from 'rxjs/operators';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';
import { HttpOptions } from '../dspace-rest-v2/dspace-rest-v2.service';
import { AuthStatus } from './models/auth-status.model';
import { isNotEmpty } from '../../shared/empty.util';
import { AuthService } from './auth.service';
import { AuthTokenInfo } from './models/auth-token-info.model';
import { CheckAuthenticationTokenAction } from './auth.actions';
import { EPerson } from '../eperson/models/eperson.model';
import { AuthMethodModel } from './models/auth-method.model';

/**
 * The auth service.
 */
@Injectable()
export class ServerAuthService extends AuthService {

  /**
   * Returns the authenticated user
   * @returns {User}
   */
  public authenticatedUser(token: AuthTokenInfo): Observable<EPerson> {
    // Determine if the user has an existing auth session on the server
    const options: HttpOptions = Object.create({});
    let headers = new HttpHeaders();

    headers = headers.append('Accept', 'application/json');
    headers = headers.append('Authorization', `Bearer ${token.accessToken}`);
    // NB this is used to pass server client IP check.
    const clientIp = this.req.get('x-forwarded-for') || this.req.connection.remoteAddress;
    headers = headers.append('X-Forwarded-For', clientIp);

    options.headers = headers;
    return this.authRequestService.getRequest('status', options).pipe(
      map((status) => this.rdbService.build(status)),
      switchMap((status: AuthStatus) => {
        if (status.authenticated) {
          return status.eperson.pipe(map((eperson) => eperson.payload));
        } else {
          throw(new Error('Not authenticated'));
        }
      }));
  }

  /**
   * Redirect to the route navigated before the login
   */
  public redirectAfterLoginSuccess(isStandalonePage: boolean) {
    this.getRedirectUrl().pipe(
      take(1))
      .subscribe((redirectUrl) => {
        if (isNotEmpty(redirectUrl)) {
          // override the route reuse strategy
          this.router.routeReuseStrategy.shouldReuseRoute = () => {
            return false;
          };
          this.router.navigated = false;
          const url = decodeURIComponent(redirectUrl);
          this.router.navigateByUrl(url);
        } else {
          // If redirectUrl is empty use history. For ssr the history array should contain the requested url.
          this.routeService.getHistory().pipe(
            filter((history) => history.length > 0),
            take(1)
          ).subscribe((history) => {
            this.navigateToRedirectUrl(history[history.length - 1] || '');
          });
        }
      })
  }

  /**
   * Retrieve authentication methods available
   * @returns {User}
   */
  public retrieveAuthMethods(): Observable<AuthMethodModel[]> {
    const options: HttpOptions = Object.create({});
    if (isNotEmpty(this.req.headers) && isNotEmpty(this.req.headers.referer)) {
      let headers = new HttpHeaders();
      headers = headers.append('X-Requested-With', this.req.headers.referer);
      options.headers = headers;
    }

    return this.authRequestService.postToEndpoint('login', {}, options).pipe(
      map((status: AuthStatus) => {
        let authMethods: AuthMethodModel[];
        if (isNotEmpty(status.authMethods)) {
          authMethods = status.authMethods;
        }
        return authMethods;
      })
    )
  }
}
