function getChatId(id1, id2) {
  const ids = [id1, id2].sort();
  return `${ids[0]}_${ids[1]}`;
}

// console.log(getChatPath);

module.exports = { getChatId };
