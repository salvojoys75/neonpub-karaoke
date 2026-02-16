import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Shield, FileText } from 'lucide-react';

export default function TermsModal({ userId }) {
  const [showTerms, setShowTerms] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    // Controlla se l'utente ha già accettato
    const accepted = localStorage.getItem(`tos_accepted_${userId}`);
    if (!accepted) {
      setShowTerms(true);
    }
  }, [userId]);

  const handleAccept = () => {
    localStorage.setItem(`tos_accepted_${userId}`, new Date().toISOString());
    setShowTerms(false);
    setHasAccepted(true);
  };

  return (
    <Dialog open={showTerms} onOpenChange={() => {}}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[90vh]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Shield className="w-7 h-7 text-fuchsia-500" />
            Termini e Condizioni d'Uso - DiscojJoys
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6 text-sm text-zinc-300">
            
            {/* AVVISO IMPORTANTE */}
            <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-yellow-500 text-lg mb-2">⚠️ IMPORTANTE - Leggi Attentamente</h3>
                  <p className="text-yellow-200">
                    L'uso di contenuti musicali nei locali pubblici richiede licenze specifiche.
                    <strong> Tu, come operatore, sei responsabile</strong> di ottenere tutte le 
                    autorizzazioni necessarie (SIAE, SCF, ecc.) per l'uso commerciale della musica.
                  </p>
                </div>
              </div>
            </div>

            {/* SEZIONE 1 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">1. Natura del Servizio</h3>
              <p className="mb-2">
                DiscojJoys è un <strong>software gestionale</strong> per eventi di intrattenimento 
                (karaoke, quiz, giochi interattivi). Il software fornisce:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Strumenti per gestire code, votazioni e partecipanti</li>
                <li>Database di domande quiz con riferimenti a contenuti esterni</li>
                <li>Funzionalità di visualizzazione per schermi pubblici</li>
              </ul>
              <p className="mt-2">
                <strong>DiscojJoys NON fornisce, distribuisce o ospita contenuti musicali.</strong> 
                Il software contiene solo link/riferimenti a contenuti pubblicamente disponibili 
                su piattaforme terze (YouTube, Spotify).
              </p>
            </div>

            {/* SEZIONE 2 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">2. Responsabilità dell'Operatore</h3>
              <p className="mb-2">
                <strong>L'OPERATORE (tu) sei l'unico responsabile di:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>Licenze musicali</strong>: Ottenere e mantenere attive tutte le licenze 
                  necessarie per l'uso pubblico e commerciale della musica nel tuo locale, incluse 
                  ma non limitate a:
                  <ul className="list-circle list-inside ml-6 mt-1">
                    <li>SIAE (Società Italiana Autori ed Editori)</li>
                    <li>SCF (Società Consortile Fonografici)</li>
                    <li>Eventuali altre licenze locali/nazionali</li>
                  </ul>
                </li>
                <li>
                  <strong>Termini di servizio terzi</strong>: Rispettare i Terms of Service di 
                  piattaforme terze (YouTube, Spotify) per l'uso dei loro contenuti
                </li>
                <li>
                  <strong>Privacy e GDPR</strong>: Gestione corretta dei dati personali dei tuoi clienti
                </li>
                <li>
                  <strong>Uso corretto del software</strong>: Utilizzare DiscojJoys solo per scopi legali
                </li>
              </ul>
            </div>

            {/* SEZIONE 3 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">3. Limitazione di Responsabilità</h3>
              <p className="mb-2">
                DiscojJoys e i suoi sviluppatori:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>NON sono responsabili</strong> per violazioni di copyright, diritti d'autore 
                  o Terms of Service commesse dall'operatore
                </li>
                <li>
                  <strong>NON garantiscono</strong> la legalità dell'uso dei contenuti linkati in ogni 
                  giurisdizione
                </li>
                <li>
                  <strong>NON forniscono consulenza legale</strong> su licenze musicali o diritti d'autore
                </li>
                <li>
                  Forniscono il software "AS IS" (così com'è) senza garanzie di alcun tipo
                </li>
              </ul>
            </div>

            {/* SEZIONE 4 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">4. Contenuti di Terze Parti</h3>
              <p className="mb-2">
                I cataloghi quiz contengono <strong>solo riferimenti (link/ID)</strong> a contenuti 
                ospitati su piattaforme esterne:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>YouTube</strong>: video musicali pubblicamente disponibili</li>
                <li><strong>Spotify</strong>: tracce audio pubblicamente disponibili</li>
              </ul>
              <p className="mt-2">
                Questi contenuti sono e rimangono di proprietà dei rispettivi detentori dei diritti.
                DiscojJoys agisce come "aggregatore di riferimenti", similmente a motori di ricerca 
                o app di music discovery.
              </p>
            </div>

            {/* SEZIONE 5 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">5. Uso dei Cataloghi</h3>
              <p className="mb-2">
                I cataloghi quiz forniti sono <strong>suggerimenti opzionali</strong>. L'operatore:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Può scegliere di non usarli e creare cataloghi propri</li>
                <li>Può modificare/rimuovere qualsiasi contenuto dai cataloghi</li>
                <li>È responsabile di verificare di avere i diritti per usare i contenuti scelti</li>
              </ul>
            </div>

            {/* SEZIONE 6 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">6. Privacy e Dati Personali</h3>
              <p>
                DiscojJoys raccoglie dati minimi (email, nome locale) per la gestione dell'account.
                Per informazioni complete, consulta la nostra Privacy Policy.
              </p>
            </div>

            {/* SEZIONE 7 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">7. Modifiche ai Termini</h3>
              <p>
                Ci riserviamo il diritto di modificare questi termini in qualsiasi momento.
                Le modifiche saranno comunicate via email e richiederanno nuova accettazione.
              </p>
            </div>

            {/* SEZIONE 8 */}
            <div>
              <h3 className="font-bold text-white text-lg mb-2">8. Contatti</h3>
              <p>
                Per domande sui termini o questioni legali, contatta: <strong>legal@discojjoys.com</strong>
              </p>
            </div>

            {/* DICHIARAZIONE FINALE */}
            <div className="bg-fuchsia-900/20 border-2 border-fuchsia-600 rounded-lg p-4 mt-6">
              <h3 className="font-bold text-white text-lg mb-2">📋 Dichiarazione di Accettazione</h3>
              <p className="text-fuchsia-200">
                Cliccando "ACCETTO", dichiari di:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-fuchsia-200 mt-2">
                <li>Aver letto e compreso questi termini</li>
                <li>Essere consapevole delle tue responsabilità legali</li>
                <li>Possedere o impegnarti a ottenere tutte le licenze necessarie (SIAE/SCF)</li>
                <li>Utilizzare il software in conformità con le leggi vigenti</li>
              </ul>
            </div>

            <div className="text-xs text-zinc-500 text-center pt-4 border-t border-zinc-800">
              Ultimo aggiornamento: Febbraio 2026 | Versione 1.0
            </div>

          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t border-zinc-800">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => window.location.href = '/tos-completo'}
          >
            <FileText className="w-4 h-4 mr-2" />
            Leggi Versione Completa
          </Button>
          <Button 
            className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-lg font-bold"
            onClick={handleAccept}
          >
            ✅ ACCETTO I TERMINI
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}