// The view box uses a unit per intersection so lines stay centered on buttons at every size.
export function boardlines(game, width, height) {
  if (game === "chess") return "";
  const line = (x1, y1, x2, y2) =>
    '<line x1="' +
    (x1 + 0.5) +
    '" y1="' +
    (y1 + 0.5) +
    '" x2="' +
    (x2 + 0.5) +
    '" y2="' +
    (y2 + 0.5) +
    '"/>';
  const paths = [];
  for (let y = 0; y < height; y++) paths.push(line(0, y, width - 1, y));
  for (let x = 0; x < width; x++) {
    if (game === "xiangqi" && x > 0 && x < width - 1)
      paths.push(line(x, 0, x, 4), line(x, 5, x, 9));
    else paths.push(line(x, 0, x, height - 1));
  }
  if (game === "xiangqi")
    for (const y of [0, 7])
      paths.push(line(3, y, 5, y + 2), line(5, y, 3, y + 2));
  if (game === "go" && width >= 9) {
    const low = width === 9 ? 2 : 3,
      high = width - 1 - low,
      mid = (width - 1) / 2;
    const pts =
      width === 9
        ? [
            [low, low],
            [low, high],
            [high, low],
            [high, high],
            [mid, mid],
          ]
        : [low, mid, high].flatMap((x) => [low, mid, high].map((y) => [x, y]));
    for (const [x, y] of pts)
      paths.push(
        '<circle fill="#72542d" cx="' +
          (x + 0.5) +
          '" cy="' +
          (y + 0.5) +
          '" r=".09"/>',
      );
  }
  return (
    '<svg class="boardlines" aria-hidden="true" viewBox="0 0 ' +
    width +
    " " +
    height +
    '" preserveAspectRatio="none" stroke="#805b2b" stroke-width=".025">' +
    paths.join("") +
    "</svg>"
  );
}
