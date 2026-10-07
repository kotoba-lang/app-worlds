(ns worlds.state
  (:require [reagent.core :as reagent]))

;; Public app descriptor, reflecting the adjacent wrangler.jsonc declarations.
(def app-info
  {:title "Worlds Mcp Component"
   :project "etzhayyim-project-worlds"
   :name "worlds-mcp-component"
   :kind "appview"
   :route-count 2
   :routes ["cvs4f8cg.etzhayyim.com/*" "worlds.etzhayyim.com/*"]
   :vars ["APP_CAPABILITIES" "APP_DESCRIPTION" "APP_DISPLAY_NAME" "APP_FRAMEWORK"
          "APP_NANOID" "APP_PERFORMER_TYPE" "APP_UI_TYPE" "AGENTGATEWAY_MCP_ROUTER_URL"]
   :xrpc true
   :relative-path "appview/worlds-mcp-component/cljs/src/worlds/ui.cljs"})
