import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

export default function configurePassport() {
  const backendBase = process.env.BACKEND_URL
    ? process.env.BACKEND_URL.replace(/\/+$/, '')
    : (process.env.NODE_ENV === 'production'
        ? 'https://whiteboard-backend-3wzu.onrender.com'
        : 'http://localhost:5000');

  const callbackURL = `${backendBase}/api/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
        proxy:        true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            {
              googleId:    profile.id,
              email:       profile.emails[0].value,
              displayName: profile.displayName,
              avatarUrl:   profile.photos[0]?.value ?? '',
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  // Not using sessions — JWT only
  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
}
