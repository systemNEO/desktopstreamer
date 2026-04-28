import { Header } from './components/Header';
import { SectionCard } from './components/SectionCard';
import { InstallProgressDialog } from './components/InstallProgressDialog';
import { SourcePicker } from './views/SourcePicker';
import { DestinationPicker } from './views/DestinationPicker';
import { StreamControl } from './views/StreamControl';

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-4xl mx-auto w-full">
        <SectionCard step={1} title="Was streamen?">
          <SourcePicker />
        </SectionCard>
        <SectionCard step={2} title="Wohin streamen?">
          <DestinationPicker />
        </SectionCard>
        <SectionCard step={3} title="Stream-Kontrolle">
          <StreamControl />
        </SectionCard>
      </main>
      <InstallProgressDialog />
    </div>
  );
}
