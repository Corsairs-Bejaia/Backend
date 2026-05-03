import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  // The returned object is attached to req.user.
  // userId === tenantId in this system (one User = one Tenant).
  // All aliases are exposed so controllers can use whichever is clearest.
  validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      id: payload.sub,
      userId: payload.sub,
      tenantId: payload.sub,
      email: payload.email,
    };
  }
}
