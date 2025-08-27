"use strict";
/**
 * Copyright 2025 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextConfig = void 0;
/**
 * Represents a context configurations. It can be global, per User Context, or per
 * Browsing Context. The undefined value means the config will be taken from the upstream
 * config. `null` values means the value should be default regardless of the upstream.
 */
class ContextConfig {
    acceptInsecureCerts;
    viewport;
    devicePixelRatio;
    // Extra headers are kept in CDP format.
    extraHeaders;
    geolocation;
    locale;
    prerenderingDisabled;
    screenOrientation;
    scriptingEnabled;
    // Timezone is kept in CDP format with GMT prefix for offset values.
    timezone;
    userPromptHandler;
    /**
     * Merges multiple `ContextConfig` objects. The configs are merged in the
     * order they are provided. For each property, the value from the last config
     * that defines it (i.e., the value is not `undefined`) will be used.
     * The final result will not contain any `undefined` properties.
     */
    static merge(...configs) {
        const result = new ContextConfig();
        for (const config of configs) {
            if (!config) {
                continue;
            }
            for (const key in config) {
                const value = config[key];
                if (value !== undefined) {
                    result[key] = value;
                }
            }
        }
        return result;
    }
}
exports.ContextConfig = ContextConfig;
//# sourceMappingURL=ContextConfig.js.map