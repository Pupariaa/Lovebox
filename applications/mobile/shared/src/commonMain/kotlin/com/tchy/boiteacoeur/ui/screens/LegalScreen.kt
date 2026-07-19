package com.tchy.boiteacoeur.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tchy.boiteacoeur.ui.components.AppScaffold
import com.tchy.boiteacoeur.ui.theme.RosePrimary

@Composable
fun LegalScreen(section: String, onBack: () -> Unit) {
    val title = when (section) {
        "privacy" -> "Confidentialité"
        "terms" -> "Conditions d'utilisation"
        else -> "Mentions légales"
    }
    val paragraphs = remember(section) {
        when (section) {
            "privacy" -> PRIVACY_PARAGRAPHS
            "terms" -> TERMS_PARAGRAPHS
            else -> LEGAL_PARAGRAPHS
        }
    }
    var page by remember(section) { mutableIntStateOf(0) }
    val lastPage = paragraphs.lastIndex

    AppScaffold(title = title, onBack = onBack) { modifier ->
        Column(
            modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
                Text(
                    text = paragraphs[page].title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = RosePrimary,
                )
                Text(
                    text = paragraphs[page].body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "${page + 1} / ${paragraphs.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = { if (page > 0) page -= 1 },
                        enabled = page > 0,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Précédent")
                    }
                    Button(
                        onClick = { if (page < lastPage) page += 1 else onBack() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = RosePrimary),
                    ) {
                        Text(if (page < lastPage) "Suivant" else "Fermer")
                    }
                }
            }
        }
    }
}

private data class LegalParagraph(val title: String, val body: String)

private val LEGAL_PARAGRAPHS = listOf(
    LegalParagraph(
        "Éditeur",
        "TechAlchemy — application Boîte à Cœur, service de messagerie affective entre boîtes connectées.",
    ),
    LegalParagraph(
        "Contact",
        "support@boite-a-coeur.fr",
    ),
    LegalParagraph(
        "Hébergement",
        "Infrastructure TechAlchemy, Union européenne.",
    ),
    LegalParagraph(
        "Données",
        "Les données techniques nécessaires au fonctionnement sont traitées conformément à la politique de confidentialité.",
    ),
)

private val PRIVACY_PARAGRAPHS = listOf(
    LegalParagraph(
        "Collecte",
        "Nous collectons les informations nécessaires à ton compte (email, profil), à tes boîtes (identifiants, statut) et aux messages envoyés.",
    ),
    LegalParagraph(
        "Messages",
        "Les messages sont stockés pour être délivrés à la boîte destinataire puis conservés dans ton historique d'envoi.",
    ),
    LegalParagraph(
        "Tes droits",
        "Tu peux demander la suppression de ton compte et dissocier tes boîtes depuis l'application.",
    ),
    LegalParagraph(
        "Partage",
        "Nous ne vendons pas tes données. Les prestataires techniques traitent des données limitées pour fournir le service.",
    ),
)

private val TERMS_PARAGRAPHS = listOf(
    LegalParagraph(
        "Usage",
        "En utilisant Boîte à Cœur, tu t'engages à utiliser le service de manière respectueuse et légale.",
    ),
    LegalParagraph(
        "Contenu",
        "Tu es responsable du contenu des messages envoyés via ton compte.",
    ),
    LegalParagraph(
        "Association",
        "L'association d'une boîte à ton compte est personnelle. Ne partage pas tes codes de liaison publiquement.",
    ),
    LegalParagraph(
        "Service",
        "Le service est fourni en l'état. Nous pouvons faire évoluer les fonctionnalités ou suspendre un compte en cas d'abus manifeste.",
    ),
)
