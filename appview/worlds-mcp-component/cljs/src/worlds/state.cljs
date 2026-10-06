(ns worlds.state
  (:require [reagent.core :as reagent]))

;; Static app descriptor (port of the `app` object in +page.svelte).
(def app-info
  {:title "Worlds Mcp Component"
   :project "etzhayyim-project-worlds"
   :name "worlds-mcp-component"
   :kind "appview"
   :route-count 0
   :routes []
   :vars []
   :xrpc true
   :relative-path "60-apps/etzhayyim-project-worlds/appview/worlds-mcp-component/svelte/src/routes/+page.svelte"})
