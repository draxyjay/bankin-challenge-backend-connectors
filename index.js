const fs = require('fs');
const axios = require('axios');

const user = 'BankinUser';
const password = '12345678';
const clientId = 'BankinClientId';
const clientSecret = 'secret';

let refresh_token = null;
let access_token = null;

const instance = axios.create({
	baseURL: 'http://localhost:3000/',
});

const login = async () => {
	await instance
		.post(
			'/login',
			{
				user: user,
				password: password,
			},
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization:
						'Basic ' +
						Buffer.from(`${clientId}:${clientSecret}`).toString(
							'base64'
						),
				},
			}
		)
		.then((res) => {
			console.log('Login successful!');
			refresh_token = res.data.refresh_token;
		})
		.catch((err) => {
			console.log(err.data);
		});
};

const getAccessToken = async () => {
	await instance
		.post('/token', {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			grant_type: 'refresh_token',
			refresh_token: refresh_token,
		})
		.then((res) => {
			console.log('Access token fetched!');
			access_token = res.data.access_token;
		})
		.catch((err) => {
			console.log(err.data);
		});
};

const fetchAccounts = async (link = '/accounts', accounts = []) => {
	return await instance
		.get(link, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + access_token,
			},
		})
		.then((res) => {
			const newAccounts = res.data.account;

			for (index in newAccounts) {
				const findByAccNumber = (acc) =>
					acc.acc_number === newAccounts[index].acc_number;

				if (!accounts.some(findByAccNumber)) {
					accounts.push(newAccounts[index]);
				}
			}

			if (!res.data.link.next) return accounts;

			return fetchAccounts(res.data.link.next, accounts);
		})
		.catch((err) => {
			console.log(err.data);
		});
};

const fetchTransactions = async (link = null, transactions = []) => {
	return await instance
		.get(link, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + access_token,
			},
		})
		.then((res) => {
			transactions.push(...res.data.transactions);

			if (!res.data.link.next) return transactions;

			return fetchTransactions(res.data.link.next, transactions);
		})
		.catch((err) => {
			console.log(`Error fetching transactions : ${link} => ${err.data}`);
		});
};

const fetchTransactionsByAccount = async (account) => {
	const transactions =
		(await fetchTransactions(
			`/accounts/${account.acc_number}/transactions`
		)) || [];

	return {
		acc_number: account.acc_number,
		amount: account.amount,
		transactions: transactions.map((t) => {
			return {
				label: t.label,
				amount: t.amount,
				currency: t.currency,
			};
		}),
	};
};

const run = async () => {
	await login();
	await getAccessToken();
	const accounts = await fetchAccounts();

	const newAccounts = [];

	for (account of accounts) {
		const newAccount = await fetchTransactionsByAccount(account);
		newAccounts.push(newAccount);
	}

	console.log(JSON.stringify(newAccounts, null, 4));
	return newAccounts;
};

const writeOutputInFile = (output) => {
	fs.writeFile(
		'output.json',
		JSON.stringify(output, null, 4),
		(err) => err && console.log(`Failed to write output in file : ${err}`)
	);
};

run().then(writeOutputInFile);
