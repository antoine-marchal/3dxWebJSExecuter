const express = require('express');
const router = express.Router();
const { executeFetchInWindow } = require('../../utils/fetchTools');

router.get('/:param', async (req, res) => {
	const paramValue = req.params.param;
	if(paramValue=="force"){
		if(global.whoamiData){
			const data = await executeFetchInWindow(global.tdxwin, global.URL+"/3dspace/resources/pno/person/getsecuritycontext", {
			  method: 'GET',
			  headers: {
				  'Content-Type': 'application/json; charset=UTF-8'
			  }
			});
			global.sc = data;
			res.json(data);
		} else {
			res.json({error:'no data'});
		}
	}
	else if(paramValue=="cspaces"){
		const data = await executeFetchInWindow(global.tdxwin, global.URL+"/3dspace/resources/bps/cspaces", {
		  method: 'GET',
		  headers: {
			  'Content-Type': 'application/json; charset=UTF-8'
		  }
		});
		res.json(Object.values(data.cspaces).map(o => o.displayName));
	}
});

router.get('/', async (req, res) => {
	if(global.sc){
		res.json(global.sc);
	}
	else if(global.whoamiData){
		const data = await executeFetchInWindow(global.tdxwin, global.URL+"/3dspace/resources/pno/person/getsecuritycontext", {
		  method: 'GET',
		  headers: {
			  'Content-Type': 'application/json; charset=UTF-8'
		  }
		});
		global.sc = data;
		res.json(data);
	} else {
		res.json({error:'no data'});
	}
});

router.post('/', async(req, res) => {
    const data = req.body; 
    global.sc = data;
	res.json(data);
});

module.exports = router;
