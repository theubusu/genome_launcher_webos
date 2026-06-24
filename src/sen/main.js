function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

// --- WEBOS LOGIC ---

let MENU_DATA = [];

//elevated luna calling (needs homebrew channel and root) + parse json
function getLunaJsonHbChannel(lunaEndpoint) {
	return new Promise((resolve, reject) => {
		var bridge = new window.PalmServiceBridge();
		
		bridge.onservicecallback = function(payload) {
			try {
				let outer = JSON.parse(payload);
				if (!outer.stdoutString) {
					reject(outer.errorText || "not stdout");
					return;
				}
				
				resolve(JSON.parse(outer.stdoutString));
			} catch(e) {
				reject(e);
			}
		};
		bridge.call('luna://org.webosbrew.hbchannel.service/exec', JSON.stringify({command: `luna-send -n 1 ${lunaEndpoint} '{}'`})
	);
});
}

let isDummy;

async function senInit() {
	// check if running on real device
	if (location.href.includes("palm/applications")) {
		console.log("[+] real mode")
		isDummy = false;
	} else {
		console.log("[+] dummy mode")
		isDummy = true;
	};
	
	//make apps
	if (!isDummy) {
		try {
			let appsResult = await getLunaJsonHbChannel("luna://com.webos.applicationManager/listApps");
			createApps(appsResult);
		} catch(e) {
			console.error("failed to get apps list:", e);
		}
	} else {
		await fetch('../dummy/listApps.json')
		.then(r => r.json())
		.then(json => createApps(json));
	}
	
	renderMenu();
	
}

function createApps(appsResult) {
	let appItems = [];
	
	for (let app of appsResult.apps) {
		//ignore non visible apps ( maybe can be changed?)
		if (!app.visible) {
			continue
		}
		
		console.log(`[app] title: ${app.title}, id: ${app.id}, path: ${app.folderPath}, icon: ${app.icon}`);
		
		let icon;
		//use large icon if avaliable
		if (app.largeIcon) {
			console.log(`use large icon: ${app.largeIcon}`);
			icon = app.largeIcon
		} else {
			icon = app.icon
		}

		//use app icon color if avaliable
		let iconColor = null;
		if (app.iconColor) {
			console.log(`use icon color: ${app.iconColor}`);
			iconColor = app.iconColor
		}
		
		appItems.push({
			name: app.title,
			icon: `../root/${app.folderPath}/${icon}`, //use the previously created root symlink
			iconColor: iconColor,
			action: `launch ${app.id}`,
		});
		
	}
	
	MENU_DATA.push({
		title: "Applications",
		items: appItems,
	})
}

function handleAction(action) {
	//launch app
	if (action.startsWith("launch")) {
		let appId = action.slice(7);
		console.log(`[launch] launcing app: ${appId}`);
		var bridge = new window.PalmServiceBridge();
		bridge.call('luna://com.webos.service.applicationManager/launch', JSON.stringify({id: appId}));
	}

	if (!isDummy) {
		closeApp();
	}
}

senInit();

// --- ORIGINAL MENU LOGIC ---

// 6*4 for 1080p
const ITEMS_VISIBLE_ON_SCREEN = 6*4;

let data = MENU_DATA;

let selectedItem = 0;
const itemElements = [];

const menu = document.getElementById('menu');

async function renderMenu() {
	document.getElementById('title').innerHTML = data[0].title;
 
	const items = data[0].items;
 
	const appendPromises = items.map((item, n) => {
		const div = document.createElement('div');
		let styleText = "";
		if (item.iconColor) {
			//use icon color
			styleText = `background-color: ${item.iconColor}`
		}

		div.className = 'item';
		div.innerHTML = `
				<img src="${item.icon}" alt="${item.name}" style="${styleText}">
				<div class="item-label"><p>${item.name}</p></div>
				`;
		div.dataset.action = item.action;
		itemElements[n] = div; //assign by index

		//visible items get animation delay, non visible will be rendered immidiately
		const wait = n < ITEMS_VISIBLE_ON_SCREEN ? delay(n * 35) : Promise.resolve();
		return wait.then(() => ({ n, div }));
	});
 
	//append by index order
	for (let n = 0; n < items.length; n++) {
		const { div } = await appendPromises[n];
		menu.appendChild(div);
	}
 
	updateSelection();
}

function updateSelection() {
	itemElements.forEach((el, i) => {
		el.classList.toggle('selected', i === selectedItem);
		el.getElementsByTagName('div')[0].classList.toggle('selected', i === selectedItem)
	});

	const selected = document.querySelector('.item.selected');

if (selected) {
    selected.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
    });
}
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
		console.log(`Action: ${action}`);
		handleAction(action);
	}
	
	updateSelection();
});