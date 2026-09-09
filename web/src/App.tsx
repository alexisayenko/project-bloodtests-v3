import { DataProvider } from './data/DataContext';
import { ResultsProvider } from './data/ResultsContext';
import { MedicalConditionsPage } from './components/conditions/MedicalConditionsPage';
import { Footer } from './components/Footer';

function App() {
  return (
    <DataProvider>
      <ResultsProvider>
        <MedicalConditionsPage />
        <Footer />
      </ResultsProvider>
    </DataProvider>
  );
}

export default App;
