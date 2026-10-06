(ns worlds.desktop
  (:require [worlds.ui :as ui]
            [reagent.dom :as rdom]))

(defn ^:export init! []
  (rdom/render [ui/root-view] (js/document.getElementById "app")))
