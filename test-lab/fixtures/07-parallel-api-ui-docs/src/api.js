export function paginate(items,page=1,limit=10){const start=page*limit;return items.slice(start,start+limit)}
