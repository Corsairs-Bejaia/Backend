import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { PrismaService } from '@shared/prisma/prisma.service';
import { hashPassword, comparePassword } from '@core/utils/hash.util';
import { RegisterDto } from './dto/register.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return null;
    return user;
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, companyName: dto.companyName },
    });

    return this.generateTokens(user);
  }

  login(user: User) {
    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        refreshToken,
        {
          secret: this.config.get<string>('jwt.secret'),
        },
      );
      if (payload.type !== 'refresh') throw new Error();

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new Error();

      const accessToken = this.jwtService.sign(
        { sub: user.id, email: user.email },
        { expiresIn: this.config.get<string>('jwt.expiry')! as StringValue },
      );
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        companyName: true,
        planTier: true,
        createdAt: true,
      },
    });
  }

  private generateTokens(user: User) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: this.config.get<string>('jwt.expiry')! as StringValue },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        expiresIn: this.config.get<string>('jwt.refreshExpiry')! as StringValue,
      },
    );
    return { accessToken, refreshToken };
  }
}
