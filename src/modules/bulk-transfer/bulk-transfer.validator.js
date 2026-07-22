const { body, param, query } = require("../../validators");

module.exports = {

    initiate: [

        body("items")
            .isArray({ min: 1 })
            .withMessage(
                "At least one item is required."
            ),

        body("items.*.destinationAccountNumber")
            .trim()
            .notEmpty()
            .withMessage(
                "Each item's destination account number is required."
            )
            .isLength({ min: 10, max: 10 })
            .withMessage(
                "Each item's destination account number must be exactly 10 digits."
            ),

        body("items.*.amount")
            .notEmpty()
            .withMessage(
                "Each item's amount is required."
            )
            .isFloat({ gt: 0 })
            .withMessage(
                "Each item's amount must be greater than zero."
            ),

        body("items.*.narration")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage(
                "Narration must be at most 100 characters."
            ),

        body("narration")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage(
                "Narration must be at most 100 characters."
            )

    ],

    confirm: [

        param("id")
            .trim()
            .notEmpty()
            .withMessage(
                "Bulk transfer ID is required."
            ),

        body("code")
            .trim()
            .notEmpty()
            .withMessage(
                "OTP code is required."
            )
            .isLength({ min: 6, max: 6 })
            .withMessage(
                "OTP code must be 6 digits."
            )

    ],

    getById: [

        param("id")
            .trim()
            .notEmpty()
            .withMessage(
                "Bulk transfer ID is required."
            )

    ],

    history: [

        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage(
                "Page must be a positive integer."
            ),

        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage(
                "Limit must be between 1 and 100."
            )

    ]

};
