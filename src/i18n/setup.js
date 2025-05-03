import i18next from "i18next"
// Build translations object
const translations = {}
// Determine if running in test environment (jest)
const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined
// Load translations based on environment
if (!isTestEnv) {
	try {
		// Dynamic imports to avoid browser compatibility issues
		const fs = require("fs")
		const path = require("path")
		const localesDir = path.join(__dirname, "i18n", "locales")
		try {
			// Find all language directories
			const languageDirs = fs.readdirSync(localesDir, { withFileTypes: true })
			const languages = languageDirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)
			// Process each language
			languages.forEach((language) => {
				const langPath = path.join(localesDir, language)
				// Find all JSON files in the language directory
				const files = fs.readdirSync(langPath).filter((file) => file.endsWith(".json"))
				// Initialize language in translations object
				if (!translations[language]) {
					translations[language] = {}
				}
				// Process each namespace file
				files.forEach((file) => {
					const namespace = path.basename(file, ".json")
					const filePath = path.join(langPath, file)
					try {
						// Read and parse the JSON file
						const content = fs.readFileSync(filePath, "utf8")
						translations[language][namespace] = JSON.parse(content)
					} catch (error) {
						console.error(`Error loading translation file ${filePath}:`, error)
					}
				})
			})
			console.log(`Loaded translations for languages: ${Object.keys(translations).join(", ")}`)
		} catch (dirError) {
			console.error(`Error processing directory ${localesDir}:`, dirError)
		}
	} catch (error) {
		console.error("Error loading translations:", error)
	}
}
// Initialize i18next with configuration
i18next.init({
	lng: "en",
	fallbackLng: "en",
	debug: false,
	resources: translations,
	interpolation: {
		escapeValue: false,
	},
})
export default i18next
//# sourceMappingURL=setup.js.map
