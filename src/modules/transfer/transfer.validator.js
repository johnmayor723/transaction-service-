const { body, param, query } = require("../../validators");

module.exports = {

    initiate: [

        body("destinationAccountNumber")
            .trim()
            .notEmpty()
            .withMessage(
                "Destination account number is required."
            )
            .isLength({ min: 10, max: 10 })
            .withMessage(
                "Destination account number must be exactly 10 digits."
            ),

        body("amount")
            .notEmpty()
            .withMessage(
                "Amount is required."
            )
            .isFloat({ gt: 0 })
            .withMessage(
                "Amount must be greater than zero."
            ),

        body("narration")
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage(
                "Narration must be at most 100 characters."
            ),

        body("destinationBankCode")
            .optional()
            .trim()
            .notEmpty()
            .withMessage(
                "Destination bank code cannot be empty."
            )

    ],

    confirm: [

        param("id")
            .trim()
            .notEmpty()
            .withMessage(
                "Transfer ID is required."
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
                "Transfer ID is required."
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
