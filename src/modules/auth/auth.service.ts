import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../common/enums/user-role.enum';
import { EnvConfig } from '../../config/env.validation';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedInitialAdmin();
  }

  private async seedInitialAdmin(): Promise<void> {
    const autoSeed = this.configService.get<boolean>('AUTO_SEED_ADMIN');
    if (!autoSeed) {
      return;
    }

    const adminEmail = this.configService.get<string>('DEFAULT_ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>(
      'DEFAULT_ADMIN_PASSWORD',
    );

    try {
      const existing = await this.usersService.findByEmail(adminEmail);
      if (!existing) {
        await this.usersService.create({
          email: adminEmail,
          password: adminPassword,
          firstName: 'Portal',
          lastName: 'Administrator',
          role: UserRole.ADMIN,
        });
        this.logger.log(`Initialized default admin account: ${adminEmail}`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not seed default admin: ${(err as Error).message}`,
      );
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const user = await this.usersService.create({
      ...registerDto,
      role: UserRole.READER,
    });
    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(loginDto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: User): AuthTokens {
    const payload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as
        `${number}h` | `${number}d` | `${number}m` | `${number}s`,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
