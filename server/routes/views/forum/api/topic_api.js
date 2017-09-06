const keystone = require('keystone');
const GridFS = require("../../../../gridfs/GridFS.js");
const User = keystone.list('User');
const Forum = keystone.list('Forum');
const ForumTopic = keystone.list('ForumTopic');
const ForumMessage = keystone.list('ForumMessage');


const API = {

	/*
	 * Create topic
	 */
	["create"]: (req, reqObject, res) => {
		const data = req.body;
		const locals = res.locals;

		// TODO: vérifier que le nom de sujet est dispo
		if (!data || !data.forum)
			return res.status(500).send({error: "Missing data or data arguments:"});

		// Créer le sujet
		const model = {
			name: data.title,
			forum: data.forum,
			views: [req.user.id]
		};
		if (data.tag && data.tag !== "none") {
			model.tag = data.tag;
		}
		const newTopic = new ForumTopic.model(model);
		newTopic._req_user = req.user;

		newTopic.save((err, topic) => {
			if (err) return res.status(500).send({error: "Error during topic creation:" + err});

			// Créer le premier message
			const newMessage = new ForumMessage.model({
				content: data.content,
				author: req.user.username,
				topic: topic.id
			});
			newMessage._req_user = req.user;
			newMessage.save((err, message) => {
				if (err) return res.status(500).send({error: "Error during first message creation:" + err});

				// Ajouter le premier message en lien direct au topic 
				ForumTopic.model.update({
					_id: topic.id
				}, {
					first: message.id,
					last: message.id
				}).exec(err => {
					if (err) return res.status(500).send({error: "Error during message linking:" + err});

					// Incremente le compteur de post
					User.model.update({_id: req.user.id}, {$inc: {'posts': 1}}, err => {
						req.flash('success', 'Sujet créé: ' + data.title);
						res.status(200).send({url: '/forum-topic/' + topic.key});
					});
				});

			});
		});

	},

	/*
	 * Remove topic
	 */
	["remove"]: (req, reqObject, res) => {
		const data = req.body;
		const locals = res.locals;

		// Checks
		if (!locals.rightKeysSet || !locals.rightKeysSet.has("forum-supprimer")) {
			return res.status(403).send({error: "You don't have the right to do this."});
		}

		// Remove messages and topic
		const queries = [];

		queries.push(ForumTopic.model.remove({_id: data.id}).exec());
		queries.push(ForumMessage.model.remove({topic: data.id}).exec());

		Promise.all(queries).then(() => {
			req.flash('success', 'Sujet supprimé');
			res.status(200).send({});
		}).catch(err => {
			res.status(500).send({error: "Error during deletion:" + err});
		});
	},


	/*
	 * Publication de post
	 */
	["selection"]: (req, reqObject, res) => {
		const data = req.body;
		const locals = res.locals;

		// Checks
		if (!locals.rightKeysSet || !locals.rightKeysSet.has("forum-articles")) {
			return res.status(403).send({error: "You don't have the right to do this."});
		}
		if (!data || !data.topicKey) {
			return res.status(500).send({error: "Missing data or topicKey in data."});
		}

		// Get message in DB
		ForumTopic.model.update({
				key: data.topicKey
			}, {
				["selection.date"]: new Date(),
				["selection.category"]: data.category
			}, (err, result) => {
			if (err)
				return res.status(500).send({error: "Error fetching data."});
			if (!result || result.n === 0)
				return res.status(200).send({error: "Unknown topic Key: " + data.topicKey});

			req.flash('success', "Article ajouté à la sélection 'En direct du forum' !");
			return res.status(200).send({});
		});
	},
	
	/*
	 * Publication de post
	 */
	["publish"]: (req, reqObject, res) => {
		const data = req.body;
		const locals = res.locals;
		const image = req.files.file1;
		const animated = req.files.file2;

		// Checks
		if (!locals.rightKeysSet || !locals.rightKeysSet.has("forum-articles")) {
			return res.status(403).send({error: "You don't have the right to do this."});
		}
		if (!data || !data.topicKey) {
			return res.status(500).send({error: "Missing data or topicKey in data."});
		}

		// Get message in DB
		ForumTopic.model.update({
			key: data.topicKey
		}, {
			["publish.date"]: new Date(),
			["publish.title"]: data.title,
			["publish.type"]: data.type,
			["publish.category"]: data.category,
			["publish.animated"]: animated !== undefined
		}, (err, result) => {
			if (err)
				return res.status(500).send({error: "Error fetching data."});
			if (!result || result.n === 0)
				return res.status(200).send({error: "Unknown topic Key: " + data.topicKey});

			// On sauvegarde l'image
			image.filename = "article-" + data.topicKey;

			GridFS.add(image, (err, id) => {
				if (err) {
					console.log(err);
					return res.status(500).send({error: "Unable to upload article image."});
				}

				if (animated) {
					animated.filename = "article-anim-" + data.topicKey;
					GridFS.add(animated, (err, id) => {
						if (err) {
							console.log(err);
							return res.status(500).send({error: "Unable to upload article animated image."});
						}

						req.flash('success', "Article ajouté à l'accueil !");
						return res.status(200).send({});
					});
				} else {
					req.flash('success', "Article ajouté à l'accueil !");
					return res.status(200).send({});
				}

			});

		});

	},

	/*
	 * Recrutement
	 */
	["recrutement"]: (req, reqObject, res) => {
		const data = req.body;
		const locals = res.locals;
		const user = req.user;

		if (!user) {
			return res.status(200).send({error: "Vous n'êtes pas authentifié."});
		}

		// formater le message
		let messageContent = "## Candidature " + user.username + "\n\n";
		messageContent += "### Le criminel\n";
		messageContent += "> **[Fiche du personnage](/member/" + user.key + ")**\n\n";
		messageContent += "### Le joueur\n";
		messageContent += "**Prénom:**  \n" + (data.first || "/") + "\n\n";
		messageContent += "**Age:**  \n" + (data.age || "/") + "\n\n";
		messageContent += "**Matos:**  \n" + (data.matos || "/") + "\n\n";
		messageContent += "**Pledge:**  \n" + (data.pledge || "/") + "\n\n";
		messageContent += "**Handle RSI:**  \n[" + data.handle + "](" + (data.handle || "/") + ")\n\n";
		messageContent += "**Frequence de jeu:**  \n" + (data.frequence || "/") + "\n\n";
		messageContent += "**Expérience MMO / Jeux et Space Sim:**  \n" + (data.experience || "/") + "\n\n";
		messageContent += "**Comment nous as-tu connu ?**  \n" + (data.where || "/") + "\n\n";
		messageContent += "**Info particulière:**  \n" + (data.info || "/") + "\n\n";
		messageContent += "**Candidature:**  \n" + (data.candidature || "/") + "\n\n";

		// Trouver le forum de recrutement
		Forum.model.findOne({key: "recrutement"}).exec((err, forum) => {
			if (err || !forum)
				return res.status(500).send({error: "Pas de forum 'recrutement' détecté."});

			// Créer le topic
			const model = {
				name: "Candidature " + user.username,
				forum: forum.id,
				views: [req.user.id],
			};
			const newTopic = new ForumTopic.model(model);
			newTopic._req_user = req.user;
			newTopic.save((err, topic) => {
				if (err) {
					return res.status(500).send({error: "Error creating recruitement topic."});
				}

				// Créer le premier message
				const newMessage = new ForumMessage.model({
					content: messageContent,
					author: req.user.username,
					topic: topic.id
				});
				newMessage._req_user = req.user;

				newMessage.save((err, message) => {
					if (err) {
						return res.status(500).send({error: "Error creating recruitement message."});
					}

					// Ajouter le premier message en lien direct au topic 
					ForumTopic.model.update({
						_id: topic.id
					}, {
						first: message.id,
						last: message.id
					}).exec(err => {
						if (err) {
							return res.status(500).send({error: "Error linking message to topic."});
						}

						return res.status(200).send({topicKey: topic.key});
					});

				});

			});

		});


	}
};


exports = module.exports = (req, res) => {
	const action = req.params['action'];

	if (API[action]) {
		try {
			API[action](req, req.body, res);
		} catch (err) {
			console.log(err);
			res.status(500).send({error: "Error in action: " + action});
		}
	} else {
		res.status(500).send({error: "Method not found: No method for action: " + action});
	}
};