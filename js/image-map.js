/* Auto-synced from admin */
const IMAGE_MAP = {
  "s4": "/image/optimized/IMG_2739.jpg"
};

if (typeof MENU !== 'undefined') {
  MENU.forEach(item => {
    if (IMAGE_MAP[item.id]) item.image = IMAGE_MAP[item.id];
  });
}
