(ns chrysalis.uas.core
  (:require [malli.core :as m]
            [malli.transform :as mt]
            [malli.error :as me]))

(def uas-schema
  [:map
   [:agent/id string?]
   [:agent/name string?]
   [:agent/type [:enum :mcp :multi-agent :orchestrated]]
   [:identity [:map [:fingerprint string?] [:public-key string?]]]
   [:memory [:map
             [:type [:enum :vector :graph :hybrid]]
             [:collections [:map
                            [:episodic {:optional true} [:sequential [:map
                                                                        [:episode/id string?]
                                                                        [:timestamp string?]
                                                                        [:source string?]
                                                                        [:duration int?]
                                                                        [:context map?]
                                                                        [:interactions [:sequential [:map
                                                                                                     [:interaction/id string?]
                                                                                                     [:timestamp string?]
                                                                                                     [:type [:enum :conversation :tool-use :decision :collaboration]]
                                                                                                     [:participants [:sequential string?]]
                                                                                                     [:content string?]
                                                                                                     [:result string?]
                                                                                                     [:effectiveness double?]]]
                                                                        [:outcome string?]
                                                                        [:lessons [:sequential string?]]
                                                                        [:skills [:sequential string?]]
                                                                        [:rating double?]]]
                            [:semantic {:optional true} [:sequential [:map
                                                                         [:concept/id string?]
                                                                         [:name string?]
                                                                         [:definition string?]
                                                                         [:related [:sequential string?]]
                                                                         [:confidence double?]
                                                                         [:sources [:sequential string?]]
                                                                         [:usage int?]
                                                                         [:last-used string?]]]]]]
             [:provider string?]]]
   [:skills [:sequential [:map
                          [:skill/id string?]
                          [:name string?]
                          [:category string?]
                          [:proficiency double?]
                          [:acquired string?]
                          [:sources [:sequential string?]]
                          [:learning-curve [:sequential [:map [:timestamp string?] [:proficiency double?] [:event string?]]]]
                          [:usage [:map [:total int?] [:success-rate double?] [:contexts [:sequential string?]] [:last-used string?]]]
                          [:prerequisites [:sequential string?]]
                          [:enables [:sequential string?]]
                          [:synergies [:sequential [:map [:skill/id string?] [:strength double?]]]]]]]
   [:knowledge [:sequential [:map
                             [:belief string?]
                             [:conviction double?]
                             [:privacy [:enum :public :private]]
                             [:source string?]
                             [:tags {:optional true} [:sequential string?]]]]]
   [:transport [:map
                [:type [:enum :https :websocket :mcp]]
                [:config map?]]]
   [:sync [:map
           [:default [:enum :streaming :lumped :check-in]]
           [:merge [:map [:conflict [:enum :latest :weighted :manual]] [:dedupe boolean?] [:skill [:enum :max :average :weighted]] [:knowledge-threshold double?]]]
           [:streaming {:optional true} [:map [:enabled boolean?] [:interval-ms int?] [:batch-size int?] [:priority-threshold double?]]]
           [:lumped {:optional true} [:map [:enabled boolean?] [:batch-interval string?] [:max-batch-size int?] [:compression boolean?]]]
           [:check-in {:optional true} [:map [:enabled boolean?] [:schedule string?] [:include-full-state boolean?]]]]]
   [:tools [:sequential [:map [:name string?] [:protocol [:enum :mcp :native :api]] [:config map?]]]]
   [:pattern-resolution [:map
                         [:distributed boolean?]
                         [:mcp-available boolean?]
                         [:performance-critical boolean?]
                         [:prefer-reusability boolean?]]]])

(defn validate-uAS [data]
  (let [t (mt/transformer mt/strip-extra-keys-transformer)]
    (if-let [err (m/explain uas-schema data t)]
      {:valid false :error (me/humanize err)}
      {:valid true :value (m/decode uas-schema data t)})))

(defn resolve-pattern [ctx]
  (cond
    (and (:distributed ctx) (:mcp-available ctx)) :mcp
    (:performance-critical ctx) :embedded
    :else :library))

(defn merge-episodic [episodes]
  (->> episodes (sort-by :timestamp) distinct))

(defn merge-semantic [concepts]
  (->> concepts (group-by :concept/id)
       (map (fn [[_ vs]] (first (sort-by :last-used > vs))))))

(defn merge-skills [skills]
  (map (fn [[_ vs]] (assoc (first (sort-by :proficiency > vs)) :sources (distinct (mapcat :sources vs)))) (group-by :skill/id skills)))

(defn converge-state [state]
  (-> state
      (update-in [:memory :collections :episodic] merge-episodic)
      (update-in [:memory :collections :semantic] merge-semantic)
      (update :skills merge-skills)))
