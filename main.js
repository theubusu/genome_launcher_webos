function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

// --- WEBOS LOGIC --- 

let MENU_DATA = [];
// this should be retrieved dynamically
const APP_PATH = "/media/developer/apps/usr/palm/applications/xyz.theubusu.launcher";

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

async function appInit() {
	// check if running on real device
	var isDummy;
	if (location.href.includes("palm/applications")) {
		console.log("[+] real mode")
		isDummy = false;
	} else {
		console.log("[+] dummy mode")
		isDummy = true;
	};

	if (!isDummy) {
		//make root symlink to get app icons (DIRTY HAX)
		let bridge = new window.PalmServiceBridge();
		bridge.call('luna://org.webosbrew.hbchannel.service/exec', JSON.stringify({command: `ln -s / ${APP_PATH}/root`}));
	}

	//create apps
    if (!isDummy) {
        try {
            let appsResult = await getLunaJsonHbChannel("luna://com.webos.applicationManager/listApps");
            createApps(appsResult);
        } catch(e) {
            console.error("failed to get apps list:", e);
        }
    } else {
        await fetch('dummy/listApps.json')
        	.then(r => r.json())
        	.then(json => createApps(json));
    }

	//create inputs and devices
    if (!isDummy) {
        try {
            let inputResult = await getLunaJsonHbChannel("luna://com.webos.service.eim/getAllInputStatus");
			let devicesResult = await getLunaJsonHbChannel("luna://com.webos.service.attachedstoragemanager/listDevices2");
			createInputsDevices(inputResult, devicesResult);
        } catch(e) {
            console.error("failed to get inputs and devices list:", e);
        }
    } else {
		let inputResult;
		let devicesResult
        await fetch('dummy/getAllInputStatus.json')
        	.then(r => r.json())
        	.then(json => inputResult = json);
		await fetch('dummy/listDevices2.json')
        	.then(r => r.json())
        	.then(json => devicesResult = json);
		createInputsDevices(inputResult, devicesResult);
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

		appItems.push({
    		name: app.title,
      		icon: `root/${app.folderPath}/${app.icon}`, //use the previously created root symlink
			//icon: "assets/missing.png",
      		action: `launch ${app.id}`,
      		type: "single_select"
    	});
	}

	MENU_DATA.push({
		category: "Applications",
		items: appItems,
	})	
}

//both go in same category
function createInputsDevices(inputResult, devicesResult) {
	let items = [];

	for (let device of inputResult.devices) {
		console.log(`[input] label: ${device.label}, appID: ${device.appId}`);

		items.push({
    		name: device.label,
			icon: "assets/source_icon_hdmi.png",	//there is icon in the device spec, but it probably wouldnt match the style here
      		action: `launch ${device.appId}`,
      		type: "double"
    	});
	}

	for (let device of devicesResult.devices) {
		console.log(`[device] name: ${device.deviceName}, type: ${device.deviceType}, ID: ${device.deviceId}`);

		let icon;
		if (device.thumbnailUri) {	//dlna will have direct network icon url 
			console.log(`use icon url: ${device.thumbnailUri}`);
			icon = device.thumbnailUri;

		} else {
			//maybe set icon based on type, can be "usb", "dms", "internal*" (if i get the icons)
			icon = "assets/missing.png"
		}

		items.push({
    		name: device.deviceName,
			icon: icon,
      		action: `mp_device ${device.deviceId}`,
      		type: "double"
    	});

	}

	MENU_DATA.push({
		category: "Connected Devices",
		items: items,
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

	//launch mediaplayer with device id
	if (action.startsWith("mp_device")) {
		let deviceId = action.slice(10);
		console.log(`[mp_device] launcing mp with device: ${deviceId}`);
		var bridge = new window.PalmServiceBridge();
		bridge.call('luna://com.webos.service.applicationManager/launch', JSON.stringify({id: "com.webos.app.mediadiscovery", params: {requestDevice: deviceId}}));
	}
}

appInit();

// --- ORIGINAL MENU LOGIC ---

let data = MENU_DATA;

let selectedCategory = 0;
let lastCategory = 0;
let selectedItem = 0;

const menu = document.getElementById('menu');

async function renderMenu() {
	menu.innerHTML = ''; // clear
	
	data.forEach((cat, i) => {
		const catDiv = document.createElement('div');
		catDiv.textContent = cat.category;
		catDiv.className = 'category' + (i === selectedCategory ? ' selected' : '');
		menu.appendChild(catDiv);
		
		if (i === selectedCategory) {
			const itemRow = document.createElement('div');
			itemRow.className = 'item-row';
			
			n = -1; // so the first item doenst wait
			if (!(lastCategory == selectedCategory)){
				// category is changed, so anim
				if (lastCategory > selectedCategory){
					//that means we moved up
					anim_class = "anim";
					anim_dir = "anim_up";
				} else {
					//moved down
					anim_class = "anim";
					anim_dir = "anim_down";
				}
			} else {
				anim_class = ""
				anim_dir = ""
			}
			
			cat.items.forEach(async (item, j) => {
				n++
				const itemDiv = document.createElement('div');
				if (item.type == "single"){
					// for single line label
					itemDiv.innerHTML = `
                <img src="${item.icon}" alt="${item.name}" class="item-icon ${anim_dir}">
                <div class="item-label-single ${anim_class}"><p>${item.name}</p></div>
                `;
				} else if (item.type == "double"){
					// for double line label
					itemDiv.innerHTML = `
                <img src="${item.icon}" alt="${item.name}" class="item-icon ${anim_dir}">
                <div class="item-label-double ${anim_class}"><p>${item.name}</p></div>
                `;
				} else if (item.type == "single_select"){
					// for single line label shown on select
					if (j === selectedItem){
						//show single if selected
						itemDiv.innerHTML = `
                    <img src="${item.icon}" alt="${item.name}" class="item-icon ${anim_dir}">
                    <div class="item-label-single ${anim_class}"><p>${item.name}</p></div>
                    `;
					} else {
						// show none if not selected
						itemDiv.innerHTML = `
                    <img src="${item.icon}" alt="${item.name}" class="item-icon ${anim_dir}">
                    <div class="item-label-none ${anim_class}"><p>${item.name}</p></div>
                    `;
					}      
				}  
				
				if (!(lastCategory == selectedCategory)){
					// category is changed, so anim
					// delay effect
					await delay(n * 40);
					itemDiv.className = 'item anim' + (j === selectedItem ? ' selected' : ''); 
				} else {
					itemDiv.className = 'item' + (j === selectedItem ? ' selected' : ''); 
				}
				itemRow.appendChild(itemDiv);   
			});
			
			menu.appendChild(itemRow);
		}
	});
	lastCategory = selectedCategory

	// scroll to selected item
	const selected = document.querySelector('.item.selected');
    if (selected) {
        selected.scrollIntoView({block: "nearest"});
    }
}

document.addEventListener('keydown', e => {
	const items = data[selectedCategory].items;
	
	if (e.key === 'ArrowDown') {
		selectedCategory = (selectedCategory + 1) % data.length;
		selectedItem = 0;
	} else if (e.key === 'ArrowUp') {
		selectedCategory = (selectedCategory - 1 + data.length) % data.length;
		selectedItem = 0;
	} else if (e.key === 'ArrowRight') {
		selectedItem = (selectedItem + 1) % items.length;
	} else if (e.key === 'ArrowLeft') {
		selectedItem = (selectedItem - 1 + items.length) % items.length;
	} else if (e.key === 'Enter') {
		const action = data[selectedCategory].items[selectedItem].action;
		console.log(`Action: ${action}`);
		handleAction(action);
	}
	
	renderMenu();
});