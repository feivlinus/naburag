# RECHTLICHES MEMORANDUM & COMPLIANCE-GUIDELINE

**Aktenzeichen:** KAN-2026-8812-REG  
**Kanzlei:** Dr. von Bergmann, Schilling & Partner Rechtsanwälte mbB, Frankfurt am Main / München  
**Praxisgruppe:** Information Technology, Regulatory & Artificial Intelligence Compliance  
**Datum:** 28. Oktober 2026  
**Empfänger:** Vorstand & Chief Compliance Officer, FinVenture Global AG, Taunusanlage 8, 60329 Frankfurt am Main  
**Betreff:** Regulatorische Einstufung, Transparenzpflichten und Haftungsrisiken beim Einsatz von generativen Foundation Models und KI-gestützter Bonitätsbewertung nach dem EU AI Act (Verordnung (EU) 2024/1689) i.V.m. DSGVO und KWG

---

## 1. Executive Summary & Wesentliche Befunde

Die FinVenture Global AG plant die konzernweite Inbetriebnahme zweier zentraler KI-gestützter Softwaresysteme für das erste Quartal 2027:
1. Das Projekt **„CreditScore-AI“**: Ein automatisiertes Scoring-System zur Vorselektion und Zinskonditionsermittlung bei Konsumentenkrediten.
2. Das Projekt **„OmniAdvisor-LLM“**: Ein interner Copilot auf Basis eines extern gehosteten Large Language Models (LLM) zur Analyse von Depotstrukturen, Erstellung von Kundenberichten und Übersetzung von Anlageberichten.

Auf Basis unserer regulatorischen Prüfung fassen wir die Rechtslage vorab wie folgt zusammen:

* **Hochrisiko-Klassifizierung von „CreditScore-AI“:** Das Kredit-Scoring-Modell fällt zweifelsfrei unter **Anhang III Nr. 5 lit. b des EU AI Act** (Zugang zu wesentlichen privaten und öffentlichen Dienstleistungen). Es unterliegt damit dem vollumfänglichen Konformitätsbewertungsverfahren nach Art. 43 AI Act, der Verpflichtung zur Einrichtung eines Risikomanagementsystems (Art. 9) und einer verpflichtenden Fundamental Rights Impact Assessment (FRIA / Grundrechte-Folgenabschätzung nach Art. 27).
* **Verbotene Praktiken prüfen (Art. 5 AI Act):** Sollten in das Scoring Merkmale einfließen, die auf Social Scoring, biometrischer Kategorisierung oder unzulässiger Emotionserkennung am Telefon basieren, droht ein absolutes Betriebsverbot nach Art. 5 Abs. 1 lit. c AI Act.
* **Transparenzpflichten bei „OmniAdvisor-LLM“ (Art. 50 AI Act):** Sobald Berichte an Endkunden versendet werden, greift eine gesetzliche Kennzeichnungspflicht für KI-generierte Inhalte. Bei der Verarbeitung von personenbezogenen Depotdaten in externen Cloud-Infrastrukturen greift zudem Art. 28 DSGVO (Auftragsverarbeitung) mit der zwingenden Notwendigkeit von Standardvertragsklauseln (SCC) oder einem Data Privacy Framework (DPF) Transfer Impact Assessment.
* **Haftungs- und Bußgeldrahmen:** Bei Verstößen gegen Art. 5 drohen Bußgelder von bis zu **35 Mio. EUR oder 7 % des weltweiten Jahresumsatzes** (je nachdem, welcher Betrag höher ist). Bei Missachtung der Hochrisiko-Vorgaben nach Art. 9–15 drohen bis zu **15 Mio. EUR oder 3 % des weltweiten Jahresumsatzes**.

---

## 2. Sachverhalt & Technische Ausgangslage

Der gutachterlichen Würdigung liegt folgender durch die IT-Architektur der Mandantin mitgeteilte Sachverhalt zugrunde:

### 2.1 Architektur CreditScore-AI
* **Datenbasis:** Trainingsdaten umfassen historische Kontobewegungen der letzten 10 Jahre, SCHUFA-Meldungen, Beschäftigungsdauer, PLZ-Gebietsstatistiken sowie Clickstream-Daten aus dem Online-Banking-Portal.
* **Modelltyp:** Gradient-Boosted Decision Trees (XGBoost) kombiniert mit einem Deep-Neural-Network-Klassifikator.
* **Automatisierungsgrad:** Kreditanfragen bis zu einer Summe von 25.000 EUR werden vollautomatisiert genehmigt oder abgelehnt, ohne dass ein menschlicher Kreditsachbearbeiter interveniert. Bei Kreditsummen darüber erfolgt eine Vorfilterung mit einer Risikomatrix.

### 2.2 Architektur OmniAdvisor-LLM
* **Datenbasis:** Geschäftsberichte, Analysten-Calls, vertrauliche Kunden-Portfoliodaten, Transaktionshistorien und freie Notizen der Vermögensberater.
* **Modelltyp:** API-Anbindung an ein proprietäres US-Modell (Hyperscaler Cloud) via Frankfurt-Region mit Zero-Data-Retention-Zusicherung des Cloud-Providers.
* **RAG-Pipeline:** Lokale Vektordatenbank auf Unternehmenservern (Qdrant), Embedding-Modell lokal gehostet, Generierung via Cloud-API.

---

## 3. Rechtliche Würdigung: EU AI Act (Verordnung (EU) 2024/1689)

### 3.1 Risikoklassifizierung nach dem horizontalen Schichtenmodell

Der AI Act unterscheidet vier Risikostufen:
1. **Unannehmbares Risiko (Art. 5):** Verboten.
2. **Hohes Risiko (Art. 6 i.V.m. Anhang III):** Strenge regulatorische Auflagen.
3. **Spezifisches Transparenzrisiko (Art. 50):** Offenlegungspflichten.
4. **Minimales/Kein Risiko:** Verhaltenskodizes auf freiwilliger Basis.

| Systemkomponente | Einstufung AI Act | Rechtsgrundlage | Konsequenz |
| :--- | :--- | :--- | :--- |
| **CreditScore-AI** | Hochrisiko-KI-System | Art. 6 Abs. 2 i.V.m. Anhang III Nr. 5 lit. b | Vollständige Konformitätsprüfung, CE-Kennzeichnung, EU-Datenbank-Registrierung |
| **OmniAdvisor-LLM** | Spezifisches Transparenzrisiko / GPAI | Art. 50 Abs. 2 & Art. 53 (sofern Modell modifiziert) | Kennzeichnungspflicht für KI-Outputs, Urheberrechts-Compliance |
| **Betrugserkennung (Fraud Detection)** | Kein Hochrisiko (Ausnahme nach Art. 6 Abs. 3) | Erwägungsgrund 65 | Nur Qualitätsmanagement, falls keine Bonitätsbewertung integriert |

### 3.2 Detailprüfung: CreditScore-AI als Hochrisiko-System

Gemäß Anhang III Nr. 5 lit. b AI Act gelten solche KI-Systeme als hochriskant, die dazu bestimmt sind:
> „...für die Bewertung der Kreditwürdigkeit natürlicher Personen oder für die Festlegung ihrer Kreditwürdigkeitseinstufung verwendet zu werden, mit Ausnahme von KI-Systemen, die zur Aufdeckung von Finanzbetrug eingesetzt werden.“

#### 3.2.1 Daten-Governance & Bias-Prävention (Art. 10 AI Act)
Die Mandantin muss nachweisen, dass die Trainings-, Validierungs- und Testdatensätze repräsentativ, fehlerfrei und vollständig sind:
* **Gefahr des Proxylernens:** Die Einbeziehung von PLZ-Gebietsstatistiken (Geomarketing) führt in der Praxis regelmäßig zu einer mittelbaren Diskriminierung aufgrund ethnischer Herkunft oder sozialer Herkunft (Verstoß gegen Art. 21 EU-Grundrechtecharta). Ein solches Feature muss aus dem Merkmalsvektor des Trainingsdatensatzes zwingend isoliert und gelöscht werden.
* **Verzerrungskorrektur:** Nach Art. 10 Abs. 5 AI Act dürfen – als eng begrenzte Ausnahme zur DSGVO – besondere Kategorien personenbezogener Daten (z. B. Geschlecht, Ethnie) verarbeitet werden, *soweit dies zwingend erforderlich ist*, um Verzerrungen (Biases) im System zu erkennen und zu korrigieren.

#### 3.2.2 Menschliche Aufsicht (Human Oversight - Art. 14 AI Act)
Die derzeit geplante vollautomatisierte Kreditablehnung bis 25.000 EUR verstößt in dieser Ausgestaltung sowohl gegen Art. 14 AI Act als auch gegen Art. 22 DSGVO:
* Das System muss konstruktiv so ausgelegt sein, dass natürliche Personen in der Lage sind:
  1. Die Wirkungsweise und Grenzen des Systems vollständig zu verstehen.
  2. Den Trend zur unkritischen Übernahme automatisierter Vorschläge („Automation Bias“) aktiv zu vermeiden.
  3. Den Betrieb über einen physischen oder digitalen Not-Aus-Schalter („Stop-Button“) jederzeit gefahrlos zu unterbrechen oder das System zu übersteuern.

---

## 4. Datenschutzrechtliche Implikationen (DSGVO)

### 4.1 Automatisierte Entscheidungen im Einzelfall (Art. 22 DSGVO)
Art. 22 Abs. 1 DSGVO normiert ein grundsätzliches Verbot einer ausschließlich auf einer automatisierten Verarbeitung beruhenden Entscheidung, die der betroffenen Person gegenüber rechtliche Wirkung entfaltet oder sie in ähnlicher Weise erheblich beeinträchtigt.

* **Subsumtion:** Die Ablehnung eines Kreditantrags stellt eine erhebliche Beeinträchtigung dar (vgl. EuGH, Urteil vom 07.12.2023 – C-634/21, *SCHUFA-Holding*).
* **Ausnahmetatbestand nach Art. 22 Abs. 2 lit. a DSGVO:** Die Automatisierung ist nur zulässig, wenn sie für den Abschluss oder die Erfüllung eines Vertrags zwischen der betroffenen Person und dem Verantwortlichen *erforderlich* ist. Die bloße Kostensenkung der Bank begründet nach herrschender Ansicht der Aufsichtsbehörden (EDSA) keine Erforderlichkeit.
* **Erforderliche Abhilfemaßnahme:** Einführung eines echten „Human-in-the-Loop“. Kreditablehnungen müssen einem Kreditsachbearbeiter mit echter Entscheidungskompetenz zur Überprüfung vorgelegt werden. Ein formaler „Stempelaugenschein“ genügt den Anforderungen des EuGH ausdrücklich nicht.

### 4.2 Auskunftsanspruch und Erklärbarkeit (Art. 15 Abs. 1 lit. h DSGVO)
Betroffene Personen haben das Recht auf aussagekräftige Informationen über die involvierte Logik sowie die Tragweite und die angestrebten Auswirkungen einer derartigen Verarbeitung. Das bedeutet: Der Einsatz von unüberprüfbaren Black-Box-Modellen ist rechtswidrig. Die Mandantin muss Post-Hoc-Erklärbarkeitsmodelle implementieren (z. B. SHAP-Werte [Shapley Additive Explanations] oder LIME), die dem Kunden aufzeigen, welche Hauptfaktoren zur Ablehnung geführt haben.

### 4.3 Rechtsgrundlage für das Modelltraining (Art. 6 Abs. 1 DSGVO)
Die Verwendung historischer Kundendaten für das Nachtraining oder Fine-Tuning interner Modelle berührt das Gebot der Zweckbindung nach Art. 5 Abs. 1 lit. b DSGVO. Ein Rückgriff auf berechtigte Interessen nach Art. 6 Abs. 1 lit. f DSGVO zur reinen Produktverbesserung erfordert eine detaillierte Dokumentation der Abwägung. Reine Pseudonymisierung belässt Daten im Anwendungsbereich der DSGVO; das Training muss zwingend auf verifizierter Anonymisierung oder synthetischen Daten beruhen.

### 4.4 Recht auf Löschung & Machine Unlearning (Art. 17 DSGVO)
Macht ein Kunde sein Recht auf Löschung geltend, erstreckt sich dieser Anspruch grundsätzlich auch auf parametrisierte Repräsentationen in neuronalen Netzwerken, sofern das Modell Daten memorisiert hat. Da selektives Machine Unlearning technisch unzuverlässig ist, muss bereits während des Trainings durch Verfahren wie Differential Privacy verhindert werden, dass individuelle Trainingspunkte rekonstruierbar bleiben.

### 4.5 Internationale Datentransfers beim Cloud-LLM (Art. 44 ff. DSGVO)
Auch wenn das Rechenzentrum des US-Hyperscalers in Frankfurt am Main liegt, unterliegt der Mutterkonzern dem US CLOUD Act. Es muss zwingend geprüft werden, ob der Anbieter unter dem EU-U.S. Data Privacy Framework (DPF) zertifiziert ist. Zusätzlich ist ein Transfer Impact Assessment (TIA) zu dokumentieren und durch clientseitige Verschlüsselung sicherzustellen, dass vor dem API-Call keine Klarnamen oder Depotnummern unverschlüsselt übertragen werden.

---

## 5. Konkreter Handlungs- & Umsetzungsplan (Compliance-Checkliste)

Zur rechtssicheren Erlangung der Marktreife müssen bis zum 30. November 2026 folgende Prüfschritte finalisiert werden:

### 5.1 Phase 1: Bestandsaufnahme und Datenbereinigung
1. **Audit der Trainingsdaten von CreditScore-AI:** Vollständige Bereinigung des Merkmalsvektors von PLZ-Gebietsstatistiken und allen indirekten Proxies für geschützte Merkmale zur Vermeidung verbotener Diskriminierung nach Art. 10 AI Act.
2. **Einbindung des Datenschutzbeauftragten (DSB):** Formaler Start einer Datenschutz-Folgenabschätzung (DSFA) gemäß Art. 35 DSGVO für beide KI-Initiativen.
3. **Vendor Risk Assessment:** Durchführung der Drittanbieterprüfung des Cloud-LLM-Providers hinsichtlich technischer Datentrennung und Auditierbarkeit.

### 5.2 Phase 2: Technische Schutzvorkehrungen und Kontrollen
1. **Implementierung des Human-in-the-Loop-Workflows:** Umbau der Antragsstrecke, sodass jede Ablehnungsempfehlung dem Kreditsachbearbeiter mit Begründungsmaske vorgelegt wird, um Art. 14 AI Act und Art. 22 DSGVO zu erfüllen.
2. **Integration von Erklärbarkeits-Dashboards:** Technische Anbindung von SHAP-Algorithmen an das Frontend der Berater zur Sicherstellung der Auskunftspflichten nach Art. 15 Abs. 1 lit. h DSGVO.
3. **Automatisierte Protokollierung:** Einrichtung unveränderlicher Audit-Logs nach Art. 12 AI Act, die sämtliche Inferenzentscheidungen und Input-Vektoren für mindestens 6 Monate revisionssicher speichern.

### 5.3 Phase 3: Regulatorische Dokumentation und Zertifizierung
1. **Erstellung der technischen Dokumentation:** Vollständige Ausarbeitung der Dokumentation gemäß Anhang IV des EU AI Act vor der Inbetriebnahme.
2. **Grundrechte-Folgenabschätzung (FRIA):** Erstellung und formale Abnahme der Folgenabschätzung nach Art. 27 AI Act unter Berücksichtigung potenziell benachteiligter Kundengruppen.
3. **Registrierung und Kennzeichnung:** Eintragung des CreditScore-AI-Systems in die offizielle EU-Datenbank für Hochrisiko-KI-Systeme und formale Anbringung der CE-Kennzeichnung.

---

## 6. Vertragliche Musterklauseln für Entwicklungs- & SaaS-Verträge

Zur Absicherung gegenüber dem Drittanbieter des Basis-LLM empfehlen wir die unverzügliche Aufnahme folgender Vertragsklauseln in das Service Level Agreement (SLA) bzw. den Auftragsverarbeitungsvertrag (AVV):

### 6.1 Klausel A: Gewährleistung von Trainingsdatenfreiheit und IP-Schutz
> **§ 12 Vertraulichkeit von Prompts und Trainingsausschluss**  
> (1) Der Anbieter verpflichtet sich ausdrücklich, sämtliche vom Auftraggeber übermittelten Eingabedaten (Prompts), Metadaten sowie die generierten Rückgabewerte (Completions) weder ganz noch in Teilen für das Training, Fine-Tuning, die Validierung oder die Verbesserung eigener oder dritter KI-Modelle zu verwenden.  
> (2) Der Anbieter stellt sicher, dass übermittelte Daten im flüchtigen Speicher verbleiben und nach Beendigung der jeweiligen Inferenz-Session unverzüglich, spätestens jedoch nach Ablauf von 24 Stunden, unwiederbringlich gelöscht werden (Zero Data Retention).

### 6.2 Klausel B: Auditrechte und Konformitätsunterstützung
> **§ 15 Regulatorische Unterstützung nach Verordnung (EU) 2024/1689**  
> (1) Der Anbieter stellt dem Auftraggeber alle Informationen, Dokumentationen und Nachweise zur Verfügung, die dieser zur Erfüllung seiner Verpflichtungen nach Kapitel III des EU AI Act (insbesondere Art. 9, 10 und 13) benötigt.  
> (2) Dies umfasst insbesondere die Offenlegung von Trainingsmetriken, bekannten Schwachstellen bezüglich Halluzinationen und Sicherheitsaudits zur Abwehr von Prompt-Injection-Angriffen.

---

## 7. Bußgeld- und Haftungsrisikomatrix

| Verstoßtatbestand | Betroffene Norm | Maximaler Bußgeldrahmen | Zivilrechtliche Haftungsfolge |
| :--- | :--- | :--- | :--- |
| **Inverkehrbringen verbotener KI-Praktiken** | Art. 5 i.V.m. Art. 99 Abs. 3 AI Act | Bis zu **35.000.000 EUR** oder **7 % des weltweiten Jahresumsatzes** | Schadensersatz nach Produkthaftungsgesetz / BGB |
| **Verletzung der Hochrisiko-Governance** | Art. 9–15 i.V.m. Art. 99 Abs. 4 AI Act | Bis zu **15.000.000 EUR** oder **3 % des weltweiten Jahresumsatzes** | Amtshaftung / Unterlassungsansprüche von Verbraucherschutzverbänden |
| **Unzulässige vollautomatisierte Entscheidung** | Art. 22 Abs. 1 i.V.m. Art. 83 Abs. 5 DSGVO | Bis zu **20.000.000 EUR** oder **4 % des weltweiten Jahresumsatzes** | Immaterieller Schadensersatz nach Art. 82 DSGVO |
| **Irreführung über KI-Urheberschaft (Deepfake/Output)** | Art. 50 Abs. 2 i.V.m. Art. 99 Abs. 5 AI Act | Bis zu **7.500.000 EUR** oder **1,5 % des weltweiten Jahresumsatzes** | Abmahnungen nach UWG (Wettbewerbsrecht) |

---

## 8. Fazit und Weiteres Vorgehen

Das Vorhaben der FinVenture Global AG ist rechtlich machbar, bedarf jedoch tiefgreifender architektonischer Nachbesserungen vor dem Go-Live:

1. **CreditScore-AI:** Die geplante vollautomatisierte Ablehnung muss zwingend in ein menschlich überwachtes Entscheidungsverfahren umgewandelt werden, um existenzbedrohende Bußgelder nach Art. 83 DSGVO und Art. 99 AI Act auszuschließen. Zudem ist der Merkmalsvektor unverzüglich um diskriminierungssensible Geodaten zu bereinigen.
2. **OmniAdvisor-LLM:** Die vertragliche Zusicherung des Cloud-Providers bezüglich des Ausschlusses von Kundendaten aus dem Modelltraining muss schriftlich fixiert und technisch über Logging-APIs auditiert werden. Ein Transfer Impact Assessment (TIA) ist vor Erstbefüllung der RAG-Pipeline mit echten Kundendaten zwingend abzuschließen.

Wir stehen Ihnen für die operative Begleitung der Grundrechte-Folgenabschätzung sowie für die Verhandlungen mit dem LLM-Provider jederzeit zur Verfügung.

---
**Dr. Alexander von Bergmann**  
*Rechtsanwalt | Fachanwalt für IT-Recht*  
*Partner der Kanzlei Dr. von Bergmann, Schilling & Partner mbB*