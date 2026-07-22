require("dotenv").config();

const required = [
    "SERVICE_NAME",
    "PORT",
    "NODE_ENV",
    "MONGODB_URI",
    "MONGODB_DATABASE",
    "ACCOUNT_SERVICE_URL",
    "JWT_SECRET",
    "FINERACT_URL",
    "FINERACT_TENANT",
    "FINERACT_BASIC_AUTH"
];

const missing = required.filter(
    (key) => !process.env[key]
);

if (missing.length > 0) {
    console.error("");

    console.error("========================================");
    console.error("CONFIGURATION ERROR");
    console.error("========================================");
    console.error("");

    missing.forEach((item) => {
        console.error(`Missing environment variable: ${item}`);
    });

    console.error("");

    process.exit(1);
}

const config = {
    serviceName: process.env.SERVICE_NAME,

    version: process.env.SERVICE_VERSION || "1.0.0",

    environment: process.env.NODE_ENV,

    port: Number(process.env.PORT),

    apiPrefix: process.env.API_PREFIX || "/api/v1",

    isDevelopment: process.env.NODE_ENV === "development",

    isProduction: process.env.NODE_ENV === "production",

    isTest: process.env.NODE_ENV === "test",

    mongo: {
        uri: process.env.MONGODB_URI,
        database: process.env.MONGODB_DATABASE || "banking_platform"
    },

    jwt: {
        secret: process.env.JWT_SECRET
    },

    accountService: {
        url: process.env.ACCOUNT_SERVICE_URL
    },

    /**
     * Not in the hard-required env list — notifications are
     * best-effort and must never block or fail a transfer, even
     * if this URL is unset or the service is unreachable.
     */
    notificationService: {
        url: process.env.NOTIFICATION_SERVICE_URL
    },

    fineract: {
        url: process.env.FINERACT_URL,
        tenant: process.env.FINERACT_TENANT,
        basicAuth: process.env.FINERACT_BASIC_AUTH
    },

    nibss: {
        provider: process.env.NIBSS_PROVIDER || "dummy"
    },

    otp: {
        length: Number(process.env.OTP_LENGTH || 6),
        expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
        maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5)
    },

    limits: {
        maxTransactionAmount: Number(process.env.MAX_TRANSACTION_AMOUNT || 5000000),
        maxDailyAmount: Number(process.env.MAX_DAILY_AMOUNT || 10000000)
    },

    fraud: {
        reviewThreshold: Number(process.env.FRAUD_REVIEW_THRESHOLD || 2000000)
    },

    scheduler: {
        pollIntervalSeconds: Number(process.env.SCHEDULER_POLL_INTERVAL_SECONDS || 60)
    },

    bulkTransfer: {
        maxItems: Number(process.env.MAX_BULK_ITEMS || 100)
    },

    reversal: {
        windowHours: Number(process.env.REVERSAL_WINDOW_HOURS || 48)
    },

    email: {
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === "true",
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER
    },

    sms: {
        termii: {
            apiKey: process.env.TERMII_API_KEY,
            senderId: process.env.TERMII_SENDER_ID,
            baseUrl: process.env.TERMII_BASE_URL || "https://api.ng.termii.com"
        }
    },

    idempotency: {
        ttlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24)
    }
};

module.exports = config;
