## For All Settings

1. Add the setting to schema definitions:

    - Add the item to `globalSettingsSchema` in `schemas/index.ts`
    - Add the item to `globalSettingsRecord` in `schemas/index.ts`
    - Example: `terminalCommandDelay: z.number().optional(),`

2. Add the setting to type definitions:

    - Add the item to `exports/types.ts`
    - Add the item to `exports/roo-code.d.ts`
    - Add the setting to `shared/ExtensionMessage.ts`
    - Add the setting to the WebviewMessage type in `shared/WebviewMessage.ts`
    - Example: `terminalCommandDelay?: number | undefined`

3. Add test coverage:
    - Add the setting to mockState in ClineProvider.test.ts
    - Add test cases for setting persistence and state updates
    - Ensure all tests pass before submitting changes

## For Checkbox Settings

1. Add the message type to WebviewMessage.ts:

    - Add the setting name to the WebviewMessage type's type union
    - Example: `| "multisearchDiffEnabled"`

2. Add the setting to ExtensionStateContext.tsx:

    - Add the setting to the ExtensionStateContextType interface
    - Add the setter function to the interface
    - Add the setting to the initial state in useState
    - Add the setting to the contextValue object
    - Example:
        ```typescript
        interface ExtensionStateContextType {
        	multisearchDiffEnabled: boolean
        	setMultisearchDiffEnabled: (value: boolean) => void
        }
        ```

3. Add the setting to ClineProvider.ts:

    - Add the setting name to the GlobalStateKey type union
    - Add the setting to the Promise.all array in getState
    - Add the setting to the return value in getState with a default value
    - Add the setting to the destructured variables in getStateToPostToWebview
    - Add the setting to the return value in getStateToPostToWebview
    - Add a case in setWebviewMessageListener to handle the setting's message type
    - Example:
        ```typescript
        case "multisearchDiffEnabled":
          await this.updateGlobalState("multisearchDiffEnabled", message.bool)
          await this.postStateToWebview()
          break
        ```

4. Add the checkbox UI to SettingsView.tsx:

    - Import the setting and its setter from ExtensionStateContext
    - Add the VSCodeCheckbox component with the setting's state and onChange handler
    - Add appropriate labels and description text
    - Example:
        ```typescript
        <VSCodeCheckbox
          checked={multisearchDiffEnabled}
          onChange={(e: any) => setMultisearchDiffEnabled(e.target.checked)}
        >
          <span style={{ fontWeight: "500" }}>Enable multi-search diff matching</span>
        </VSCodeCheckbox>
        ```

5. Add the setting to handleSubmit in SettingsView.tsx:

    - Add a vscode.postMessage call to send the setting's value when clicking Save
    - This step is critical for persistence - without it, the setting will not be saved when the user clicks Save
    - Example:
        ```typescript
        vscode.postMessage({ type: "multisearchDiffEnabled", bool: multisearchDiffEnabled })
        ```

6. Style Considerations:
    - Use the VSCodeCheckbox component from @vscode/webview-ui-toolkit/react instead of HTML input elements
    - Wrap each checkbox in a div element for proper spacing
    - Use a span with className="font-medium" for the checkbox label inside the VSCodeCheckbox component
    - Place the description in a separate div with className="text-vscode-descriptionForeground text-sm mt-1"
    - Maintain consistent spacing between configuration options
    - Example:
        ```typescript
        <div>
          <VSCodeCheckbox
            checked={terminalPowershellCounter ?? true}
            onChange={(e: any) => setCachedStateField("terminalPowershellCounter", e.target.checked)}
            data-testid="terminal-powershell-counter-checkbox">
            <span className="font-medium">{t("settings:terminal.powershellCounter.label")}</span>
          </VSCodeCheckbox>
          <div className="text-vscode-descriptionForeground text-sm mt-1">
            {t("settings:terminal.powershellCounter.description")}
          </div>
        </div>
        ```

## For Select/Dropdown Settings

1. Add the message type to WebviewMessage.ts:

    - Add the setting name to the WebviewMessage type's type union
    - Example: `| "preferredLanguage"`

2. Add the setting to ExtensionStateContext.tsx:

    - Add the setting to the ExtensionStateContextType interface
    - Add the setter function to the interface
    - Add the setting to the initial state in useState with a default value
    - Add the setting to the contextValue object
    - Example:
        ```typescript
        interface ExtensionStateContextType {
        	preferredLanguage: string
        	setPreferredLanguage: (value: string) => void
        }
        ```

3. Add the setting to ClineProvider.ts:

    - Add the setting name to the GlobalStateKey type union
    - Add the setting to the Promise.all array in getState
    - Add the setting to the return value in getState with a default value
    - Add the setting to the destructured variables in getStateToPostToWebview
    - Add the setting to the return value in getStateToPostToWebview
    - This step is critical for UI display - without it, the setting will not be displayed in the UI
    - Add a case in setWebviewMessageListener to handle the setting's message type
    - Example:
        ```typescript
        case "preferredLanguage":
          await this.updateGlobalState("preferredLanguage", message.text)
          await this.postStateToWebview()
          break
        ```

4. Add the select UI to SettingsView.tsx:

    - Import the setting and its setter from ExtensionStateContext
    - Add the select element with appropriate styling to match VSCode's theme
    - Add options for the dropdown
    - Add appropriate labels and description text
    - Example:
        ```typescript
        <select
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          style={{
            width: "100%",
            padding: "4px 8px",
            backgroundColor: "var(--vscode-input-background)",
            color: "var(--vscode-input-foreground)",
            border: "1px solid var(--vscode-input-border)",
            borderRadius: "2px"
          }}>
          <option value="English">English</option>
          <option value="Spanish">Spanish</option>
          ...
        </select>
        ```

5. Add the setting to handleSubmit in SettingsView.tsx:
    - Add a vscode.postMessage call to send the setting's value when clicking Done
    - Example:
        ```typescript
        vscode.postMessage({ type: "preferredLanguage", text: preferredLanguage })
        ```

These steps ensure that:

- The setting's state is properly typed throughout the application
- The setting persists between sessions
- The setting's value is properly synchronized between the webview and extension
- The setting has a proper UI representation in the settings view
- Test coverage is maintained for the new setting

## Adding a New Configuration Item: Summary of Required Changes

To add a new configuration item to the system, the following changes are necessary:

1. **Feature-Specific Class** (if applicable)

    - For settings that affect specific features (e.g., Terminal, Browser, etc.)
    - Add a static property to store the value
    - Add getter/setter methods to access and modify the value

2. **Schema Definition**

    - Add the item to globalSettingsSchema in schemas/index.ts
    - Add the item to globalSettingsRecord in schemas/index.ts

3. **Type Definitions**

    - Add the item to exports/types.ts
    - Add the item to exports/roo-code.d.ts
    - Add the item to shared/ExtensionMessage.ts
    - Add the item to shared/WebviewMessage.ts

4. **UI Component**

    - Create or update a component in webview-ui/src/components/settings/
    - Add appropriate slider/input controls with min/max/step values
    - Ensure the props are passed correctly to the component in SettingsView.tsx
    - Update the component's props interface to include the new settings

5. **Translations**

    - Add label and description in webview-ui/src/i18n/locales/en/settings.json
    - Update all other languages
    - If any language content is changed, synchronize all other languages with that change
    - Translations must be performed within "translation" mode so change modes for that purpose

6. **State Management**

    - Add the item to the destructuring in SettingsView.tsx
    - Add the item to the handleSubmit function in SettingsView.tsx
    - Add the item to getStateToPostToWebview in ClineProvider.ts
    - Add the item to getState in ClineProvider.ts with appropriate default values
    - Add the item to the initialization in resolveWebviewView in ClineProvider.ts

7. **Message Handling**

    - Add a case for the item in webviewMessageHandler.ts

8. **Implementation-Specific Logic**

    - Implement any feature-specific behavior triggered by the setting
    - Examples:
        - Environment variables for terminal settings
        - API configuration changes for provider settings
        - UI behavior modifications for display settings

9. **Testing**

    - Add test cases for the new settings in appropriate test files
    - Verify settings persistence and state updates

10. **Ensuring Settings Persistence Across Reload**

    To ensure settings persist across application reload, several key components must be properly configured:

    1. **Initial State in ExtensionStateContextProvider**:

        - Add the setting to the initial state in the useState call
        - Example:
            ```typescript
            const [state, setState] = useState<ExtensionState>({
            	// existing settings...
            	newSetting: false, // Default value for the new setting
            })
            ```

    2. **State Loading in ClineProvider**:

        - Add the setting to the getState method to load it from storage
        - Example:
            ```typescript
            return {
            	// existing settings...
            	newSetting: stateValues.newSetting ?? false,
            }
            ```

    3. **State Initialization in resolveWebviewView**:

        - Add the setting to the initialization in resolveWebviewView
        - Example:
            ```typescript
            this.getState().then(
            	({
            		// existing settings...
            		newSetting,
            	}) => {
            		// Initialize the setting with its stored value or default
            		FeatureClass.setNewSetting(newSetting ?? false)
            	},
            )
            ```

    4. **State Transmission to Webview**:

        - Add the setting to the getStateToPostToWebview method
        - Example:
            ```typescript
            return {
            	// existing settings...
            	newSetting: newSetting ?? false,
            }
            ```

    5. **Setter Method in ExtensionStateContext**:
        - Add the setter method to the contextValue object
        - Example:
            ```typescript
            const contextValue: ExtensionStateContextType = {
            	// existing properties and methods...
            	setNewSetting: (value) => setState((prevState) => ({ ...prevState, newSetting: value })),
            }
            ```

11. **Debugging Settings Persistence Issues**

    If a setting is not persisting across reload, check the following:

    1. **Complete Chain of Persistence**:

        - Verify that the setting is added to all required locations:
            - globalSettingsSchema and globalSettingsRecord in schemas/index.ts
            - Initial state in ExtensionStateContextProvider
            - getState method in ClineProvider.ts
            - getStateToPostToWebview method in ClineProvider.ts
            - resolveWebviewView method in ClineProvider.ts (if feature-specific)
        - A break in any part of this chain can prevent persistence

    2. **Default Values Consistency**:

        - Ensure default values are consistent across all locations
        - Inconsistent defaults can cause unexpected behavior

    3. **Message Handling**:

        - Confirm the webviewMessageHandler.ts has a case for the setting
        - Verify the message type matches what's sent from the UI

    4. **UI Integration**:

        - Check that the setting is included in the handleSubmit function in SettingsView.tsx
        - Ensure the UI component correctly updates the state

    5. **Type Definitions**:

        - Verify the setting is properly typed in all relevant interfaces
        - Check for typos in property names across different files

    6. **Storage Mechanism**:
        - For complex settings, ensure proper serialization/deserialization
        - Check that the setting is being correctly stored in VSCode's globalState

    These checks help identify and resolve common issues with settings persistence.
