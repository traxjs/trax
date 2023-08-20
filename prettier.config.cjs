/** @type {import("prettier").Config} */
module.exports = {
    tabWidth: 4,
    printWidth: 120,
    overrides: [
        {
            files: "*.md",
            options: {
                tabWidth: 2,
            },
        },
    ],
};
