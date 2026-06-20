function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

let data = [];

fetch('content/sen.json')
  .then(response => response.json())
  .then(json => {
    data = json;
    renderMenu();
  })
  .catch(err => console.error('Failed to load JSON:', err));

let selectedItem = 0;

const itemElements = [];

const menu = document.getElementById('menu');

async function renderMenu() {
    document.getElementById('title').innerHTML = data[0].title;

    n = -1;

    data[0].items.forEach(async item => {
        n++
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
        <img src="${item.icon}" alt="${item.name}">
        <div class="item-label"><p>${item.name}</p></div>
        `;
        div.dataset.action = item.action;
        itemElements.push(div);
        await delay(n * 35);
        menu.appendChild(div); 
    });
    await delay(n * 60); //so focus shows after finishing all anim
    updateSelection();
}

function updateSelection() {
    itemElements.forEach((el, i) => {
        el.classList.toggle('selected', i === selectedItem);
        el.getElementsByTagName('div')[0].classList.toggle('selected', i === selectedItem)
    });
}

function getColumnsFromDOM() {
    const firstTop = itemElements[0].offsetTop;
    let cols = 1;
    for (let i = 1; i < itemElements.length; i++) {
        if (itemElements[i].offsetTop !== firstTop) break;
        cols++;
    }
    return cols;
}

document.addEventListener('keydown', (e) => {
    const total = itemElements.length;
    const columns = getColumnsFromDOM();

    if (e.key === 'ArrowRight') {
      selectedItem = (selectedItem + 1) % total;
    } else if (e.key === 'ArrowLeft') {
      selectedItem = (selectedItem - 1 + total) % total;
    } else if (e.key === 'ArrowDown') {
      if (selectedItem + columns < total) {
        selectedItem += columns;
      }
    } else if (e.key === 'ArrowUp') {
      if (selectedItem - columns >= 0) {
        selectedItem -= columns;
      }
    } else if (e.key === 'Enter') {
      const action = itemElements[selectedItem].dataset.action;
      // alert(`Action: ${action}`); // put logic here
      menuAction(action);
    }

    updateSelection();
});

renderMenu();