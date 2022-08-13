function getSortedIds(id1, id2) {
  return [id1, id2].sort();
}

function getChatId(id1, id2) {
  const ids = getSortedIds(id1, id2);
  return `${ids[0]}_${ids[1]}`;
}

// console.log(getChatPath);

module.exports = { getChatId, getSortedIds };
