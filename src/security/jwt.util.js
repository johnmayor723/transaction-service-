const jwt = require("jsonwebtoken");

const config = require("../config/app.config");

/**
 * ==========================================================
 * JWT Verification
 * ==========================================================
 *
 * This service never issues tokens (Auth Service does) — it
 * only verifies tokens signed with the same shared JWT_SECRET.
 */

/**
 * Verify JWT.
 */
const verify = (token) => {

    return jwt.verify(
        token,
        config.jwt.secret
    );

};

/**
 * Extract Bearer token.
 */
const extractToken = (header) => {

    if (!header) {
        return null;
    }

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    return header.replace(
        "Bearer ",
        ""
    );

};

module.exports = {
    verify,
    extractToken
};
