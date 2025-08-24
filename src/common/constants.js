import { Dimensions } from 'react-native';

export const screenWidth = Dimensions.get('window').width;

export const predefined_banks = [
  'Poste Italiane', 'Intesa Sanpaolo', 'UniCredit', 'Banca Sella', 'Banco BPM', 'Monte dei Paschi di Siena (MPS)',
  'BNL', 'BPER Banca', 'Credem', 'FinecoBank', 'Mediolanum', 'ING', 'Revolut', 'Hype', 'N26', 'PayPal'
];

export const categories = ['Cibo', 'Auto', 'Viaggi', 'Vacanze', 'Trasporti', 'Casa', 'Uscite', 'Salute', 'Spese Mediche', 'Abbigliamento', 'Giardinaggio', 'Lavoro', 'Regali', 'Tempo Libero', 'Sport', 'Assicurazione', 'Prelievo', 'Trasferimento', 'Altro'];
export const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);