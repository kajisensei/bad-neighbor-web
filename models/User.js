var keystone = require('keystone');
var Types = keystone.Field.Types;

/**
 * User Model
 * ==========
 */
var User = new keystone.List('User', {
	label: "Utilisateur",
	map: {
		name: "username",
	},
	autokey: { from: 'username', path: 'key', unique: true },
});

User.add({
	
	username: {
		type: String,
		initial: true,
		required: true,
		unique: true,
		index: true,
		label: "Nom d'utilisateur"
	},
	
	email: {
		type: Types.Email,
		initial: true,
		required: true,
		unique: true,
		index: true,
		label: "Email"
	},
	
	password: {
		type: Types.Password,
		initial: true,
		required: true,
		label: "Mot de passe"
	},
	
	createdAt: {
		type: Date,
		default: Date.now,
		noedit: true,
		label: "Date d'ajout"
	},
}, 'Personnel (Informations facultatives)', {

	personnal: {
		name: {
			type: Types.Name,
			label: "Nom réel"
		},

		city: {
			type: String,
			label: "Pays - Ville"
		},

		birthday: {
			type: Types.Date,
			label: "Date de naissance"
		},
	}
	
}, 'Permissions', {
	
	permissions: {
		isAdmin: {
			type: Boolean,
			label: 'Administrateur',
			index: true
		},
	}
	
}, 'Star Citizen', {

	starCitizen: {
		isSC: {
			type: Boolean,
			label: "Ce joueur joue à Star Citizen"
		},

		character: {
			type: Types.Name,
			label: "Nom du personnage",
			dependsOn: { "starCitizen.isSC": true}
		},

		description: {
			type: Types.Html,
			wysiwyg: true,
			label: "Description du personnage",
			note: "Cette description sera utilisée pour le module McCoy",
			dependsOn: { "starCitizen.isSC": true}
		},

		role: {
			type: Types.Select, options: [
				{value: 'none', label: 'Aucun'},
				{value: 'faucheur', label: 'Faucheur'},
				{value: 'corrupteur', label: 'Corrupteur'},
			],
			default: 'none',
			index: true,
			label: "Rôle",
			dependsOn: { "starCitizen.isSC": true}
		},

		jobs: {
			type: Types.Relationship,
			ref: 'SCJob',
			many: true,
			label: "Jobs",
			dependsOn: { "starCitizen.isSC": true}
		},
	}
	
});

// Provide access to Keystone
User.schema.virtual('canAccessKeystone').get(function () {
	return this.permissions.isAdmin;
});


/**
 * Relationships
 */
User.relationship({ref: 'Post', path: 'posts', refPath: 'author'});


/**
 * Registration
 */
User.defaultSort = '-createdAt';
User.defaultColumns = 'username, email, permissions.isAdmin, createdAt';
User.register();
