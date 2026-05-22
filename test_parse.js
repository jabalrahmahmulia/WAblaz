const parseTargets = (text) => {
    if (!text || !text.trim()) return [];

    return text.trim().split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(':');
        return {
          number: parts[0].trim(),
          name: parts[1] || '',
          values: parts.slice(2).map(v => v.trim())
        };
      });
  };

console.log(parseTargets(`
6281111
6282222:Budi
6283333:Andi:X:Y
`));
