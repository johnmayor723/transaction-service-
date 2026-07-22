const { body, param, query } = require("express-validator");

/**
 * Common reusable validators.
 */

const accountNumber = (field = "accountNumber") =>
    body(field)
        .trim()
        .notEmpty()
        .withMessage("Account number is required.")
        .isLength({ min: 10, max: 10 })
        .withMessage("Account number must be exactly 10 digits.")
        .isNumeric()
        .withMessage("Account number must contain only digits.");

const email = (field = "email") =>
    body(field)
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Invalid email address.")
        .normalizeEmail();

const phoneNumber = (field = "phoneNumber") =>
    body(field)
        .trim()
        .notEmpty()
        .withMessage("Phone number is required.")
        .matches(/^[0-9]{10,15}$/)
        .withMessage("Invalid phone number.");

const requiredString = (field, label) =>
    body(field)
        .trim()
        .notEmpty()
        .withMessage(`${label} is required.`);

module.exports = {
    body,
    param,
    query,
    accountNumber,
    email,
    phoneNumber,
    requiredString
};
