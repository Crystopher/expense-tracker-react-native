// Funzione per formattare gli importi in valuta
export const formatCurrency = (amount) => {
    if (typeof amount !== 'number') {
        return '€0.00';
    }
    return `€${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// Funzione per ottenere l'icona del conto in base al nome della banca
export const getBankIconName = (bankName) => {
    const lowerCaseName = bankName.toLowerCase();
    if (lowerCaseName.includes('poste') || lowerCaseName.includes('postepay')) {
      return 'post';
    } else if (lowerCaseName.includes('intesa')) {
      return 'bank-outline';
    } else if (lowerCaseName.includes('unicredit')) {
      return 'piggy-bank-outline';
    } else if (lowerCaseName.includes('banca sella')) {
      return 'hand-coin-outline';
    } else if (lowerCaseName.includes('banco bpm')) {
      return 'handshake-outline';
    } else if (lowerCaseName.includes('monte dei paschi')) {
      return 'castle-outline';
    } else if (lowerCaseName.includes('bnl')) {
      return 'bank-plus';
    } else if (lowerCaseName.includes('bper')) {
      return 'safe-square-outline';
    } else if (lowerCaseName.includes('credem')) {
      return 'cash-check';
    } else if (lowerCaseName.includes('fineco')) {
      return 'chart-line';
    } else if (lowerCaseName.includes('mediolanum')) {
      return 'office-building-outline';
    } else if (lowerCaseName.includes('ing')) {
      return 'finance';
    } else if (lowerCaseName.includes('revolut') || lowerCaseName.includes('hype') || lowerCaseName.includes('n26')) {
      return 'credit-card-fast-outline';
    } else if (lowerCaseName.includes('paypal')) {
      return 'paypal';
    } else {
      return 'bank'; // Icona generica per le altre banche
    }
  };