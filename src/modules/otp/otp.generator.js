const crypto = require("crypto");

/**
 * ==========================================================
 * OTP Generator
 * ==========================================================
 *
 * Generates numeric OTPs and hashes them.
 *
 * Plain OTP:
 *      Sent to customer.
 *
 * Hash:
 *      Stored in database.
 * ==========================================================
 */

class OtpGenerator {

    /**
     * Generate 6-digit OTP.
     */
    generate() {

        return String(

            crypto.randomInt(
                100000,
                999999
            )

        );

    }

    /**
     * SHA-256 Hash
     */
    hash(code) {

        return crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

    }

    /**
     * Verify OTP
     */
    verify(
        plainCode,
        storedHash
    ) {

        const hash =
            this.hash(
                plainCode
            );

        return hash === storedHash;

    }

}

module.exports =
    new OtpGenerator();
