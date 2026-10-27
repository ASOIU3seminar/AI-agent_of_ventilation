import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

function App() {
  const [cadFile, setCadFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleProcess = async () => {
    if (!cadFile || !excelFile) {
      setError('Загрузите оба файла (DWG и XLSX) для начала расчета.');
      return;
    }
    
    setError('');
    setIsProcessing(true);
    
    const formData = new FormData();
    formData.append('cadFile', cadFile);
    formData.append('excelFile', excelFile);

    try {
      // Запрос к C# backend (настроенному в docker-compose на порт 5000)
      const response = await axios.post('http://localhost:5000/api/hvac/calculate', formData, {
        responseType: 'blob', // Ожидаем бинарный файл (Excel) в ответ
      });

      // Автоматическое скачивание файла ХОВС
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ХОВС_ГОСТ_21.602.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (err) {
      setError('Ошибка при расчете. Проверьте правильность исходных данных.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Генератор ХОВС (AI-Agent)
        </h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Блок загрузки DWG */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
            <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
            <label className="cursor-pointer text-center">
              <span className="text-blue-600 hover:underline">Выберите CAD чертеж</span> (DWG/DXF)
              <input type="file" className="hidden" accept=".dwg,.dxf" onChange={(e) => setCadFile(e.target.files[0])} />
            </label>
            {cadFile && <p className="text-sm text-green-600 mt-2 font-medium">✓ Загружено: {cadFile.name}</p>}
          </div>

          {/* Блок загрузки Excel атрибутов */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
            <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
            <label className="cursor-pointer text-center">
              <span className="text-blue-600 hover:underline">Выберите таблицу помещений</span> (Excel)
              <input type="file" className="hidden" accept=".xlsx" onChange={(e) => setExcelFile(e.target.files[0])} />
            </label>
            {excelFile && <p className="text-sm text-green-600 mt-2 font-medium">✓ Загружено: {excelFile.name}</p>}
          </div>

          {/* Кнопка расчета */}
          <button 
            onClick={handleProcess}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all disabled:bg-gray-400"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Идет расчет по СП 60.13330...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Сгенерировать ХОВС
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;