import axios from "axios"
import { BRAVE_API_KEY } from "../config"
export async function braveSearch(query) {
	const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
		params: {
			q: query,
			count: 10,
			safesearch: "off",
		},
		headers: {
			Accept: "application/json",
			"X-Subscription-Token": BRAVE_API_KEY,
		},
		timeout: 10000,
	})
	// Maintain the same return structure as the original code
	return { response: response.data }
}
//# sourceMappingURL=brave-search.js.map
