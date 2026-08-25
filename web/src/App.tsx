import { DataProvider } from './data/DataContext';
import { ResultsProvider } from './data/ResultsContext';
import { MedicalConditionsPage } from './components/conditions/MedicalConditionsPage';

function App() {
  return (
    <DataProvider>
      <ResultsProvider>
        <MedicalConditionsPage />
      </ResultsProvider>
    </DataProvider>
  );
}

export default App;
