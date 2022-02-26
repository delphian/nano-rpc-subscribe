exports.nSub = function(config) {
        this.config = config;
	this.pubSub = require('pubsub-js');
	this.nRpc = config['nRpc'];
	if (typeof this.nRpc == undefined) {
		let NanoRpcClient = require('nano-rpc-client');
		this.nRpc = new NanoRpcClient.nRpc();
	}
	this.polling = (typeof config['polling'] != 'undefined') ? config.polling : 60;
	this.history = {};
	this.subscribers = [];
	this.timerId = null;
	/**
	 * Get all account addresses that are being subscribed to.
	 * @returns	[Array]			Account addresses.
	 */
	this.getSubscribedAccounts = function() {
		let accounts = [];
		for (let x = 0; x < this.subscribers.length; x++) {
			let subscriber = this.subscribers[x];
			if (accounts.includes(subscriber.account) != true)
				accounts.push(subscriber.account);
		}
		return accounts;
	};
	this.subscribe = function(account, callback) {
		this.subscribers.push({
			account: account,
			type: "all"
		});
		this.pubSub.subscribe(`${account}`, callback);
	};
	this.subReceivable = function(account, callback) {
		this.subscribers.push({
			account: account,
			type: "receivable"
		});
		this.pubSub.subscribe(`${account}:receivable`, callback);
	};
	this.publishReceivableBlocksAsync = async function(accounts, options) {
        	let accountsReceivableBlocks = await this.nRpc.getReceivableBlocksInfoAsync(accounts, { sort: 'descending' });
                let accountsReceivable = Object.keys(accountsReceivableBlocks);
                for (let x = 0; x < accountsReceivable.length; x++) {
                	let account = accountsReceivable[x];
                        let receivableBlocks = accountsReceivableBlocks[account];
                        if (typeof this.history[account] == 'undefined')
                        	this.history[account] = {
                                	receivable: []
                                };
                        for (let y = 0; y < receivableBlocks.length; y++) {
                        	let receivableBlock = receivableBlocks[y];
                                if (this.history[account].receivable.includes(receivableBlock.height) == false) {
					let response = {
						type: 'receivable',
						data: receivableBlock
					};
                               		this.pubSub.publish(`${account}:receivable`, response);
                                        this.pubSub.publish(`${account}`, response);
                                        this.history[account].receivable.push(receivableBlock.height);
                                }
                	}
                }
	};
	this.start = function() {
		if (this.timerId != null)
			throw "Already running";
		this.timerId = setInterval(async () => {
			let accounts = this.getSubscribedAccounts();
			this.publishReceivableBlocksAsync(accounts);
		}, this.polling * 1000);
	};
	this.stop = function() {
		if (this.timerId == null)
			throw "Not running";
		clearInterval(this.timerId);
	};
};
