/**
 * Environment Variables Validator
 * Ensures all required env vars are present and valid for production
 */

const requiredEnvVars = [
  'JWT_SECRET',
];

// In Prisma, we usually just need DATABASE_URL, not all the granular ones.
if (!process.env.DATABASE_URL) {
  requiredEnvVars.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER');
}

const checkEnvVars = () => {
  console.log('🔍 Validating environment variables...');
  
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.length < 32) {
      console.error('❌ JWT_SECRET must be at least 32 characters in production');
      console.error('   Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      process.exit(1);
    }
    
    // Check for default/weak secrets
    const weakSecrets = [
      'evaluasi-mi-secret-key-2026-change-this-in-production',
      'your-secret-key',
      'secret',
      'test',
      'development'
    ];
    
    if (weakSecrets.includes(process.env.JWT_SECRET.toLowerCase())) {
      console.error('❌ JWT_SECRET appears to be a default/weak value. Please change it!');
      process.exit(1);
    }
  }

  // Validate PORT if provided (Vercel might not provide PORT directly in serverless)
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.warn('⚠️ Invalid PORT number provided, using default');
    }
  }

  // Validate NODE_ENV
  const validEnv = ['development', 'staging', 'production'];
  if (process.env.NODE_ENV && !validEnv.includes(process.env.NODE_ENV)) {
    console.warn(`⚠️ Unknown NODE_ENV: ${process.env.NODE_ENV}`);
  }

  // Log validated environment
  console.log('✅ All environment variables validated');
  console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`   JWT Expiry: ${process.env.JWT_EXPIRES_IN || '7d'}`);
};

export { checkEnvVars };
