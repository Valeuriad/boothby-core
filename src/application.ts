import {AuthenticationComponent, registerAuthenticationStrategy} from '@loopback/authentication';
import {
  SECURITY_SCHEME_SPEC, User,
  UserRepository
} from '@loopback/authentication-jwt';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import {genSalt, hash} from 'bcryptjs';
import path from 'path';
import {JWTStrategy} from './authentication-strategies/jwt-strategies';
import {PasswordHasherBindings, TokenServiceBindings, TokenServiceConstants, UserServiceBindings} from './keys';
import {MySequence} from './sequence';
import {BcryptHasher} from './services/hash.password';
import {JWTService} from './services/jwt.service';
import {MyUserService} from './services/user.service';

export {ApplicationConfig};

export class BoothbyApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // setup binding
    this.setupBinding();

    // Add security spec
    this.addSecuritySpec();

    this.component(AuthenticationComponent);
    registerAuthenticationStrategy(this, JWTStrategy)

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };

  }

  async migrateSchema(options?: SchemaMigrationOptions) {
    await super.migrateSchema(options);

    // Create admin user if does not exists
    const userRepo = await this.getRepository(UserRepository);
    const found = await userRepo.findOne({where: {username: 'admin'}});
    if (!found) {
      const admin = new User({username: 'admin', email: 'admin@boothby.fr'});
      admin.password = await hash('admin', await genSalt());
      admin.email = 'admin@boothby.fr'
      await userRepo.create(admin);
    }
  }

  setupBinding(): void {
    this.bind(PasswordHasherBindings.PASSWORD_HASHER).toClass(BcryptHasher);
    this.bind(PasswordHasherBindings.ROUNDS).to(10)
    this.bind(UserServiceBindings.USER_SERVICE).toClass(MyUserService);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);
    this.bind(TokenServiceBindings.TOKEN_SECRET).to(TokenServiceConstants.TOKEN_SECRET_VALUE)
    this.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to(TokenServiceConstants.TOKEN_EXPIRES_IN_VALUE);
  }

  addSecuritySpec(): void {
    this.api({
      openapi: '3.0.0',
      info: {
        title: 'boothby',
        version: '2.0.0',
      },
      paths: {},
      components: {securitySchemes: SECURITY_SCHEME_SPEC},
      security: [
        {
          // secure all endpoints with 'jwt'
          jwt: [],
        },
      ],
      servers: [{url: '/'}],
    });
  }
}
