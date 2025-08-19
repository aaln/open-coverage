"""
MLflow model management and registry.
"""

import mlflow
import mlflow.sklearn

from mlflow.exceptions import MlflowException


class ModelRegistryManager:
    """
    Class to manage the registration, versioning, and retrieval of models
    using MLflow.
    """
    def __init__(self, model_name: str):
        self.model_name = model_name

    def register_model(self, run_id: str):
        """
        Register a model in MLflow given a specific run ID.
        """
        try:
            result = mlflow.register_model(
                f"runs:/{run_id}/model",
                self.model_name
            )
            print(f"Registering model with name: {self.model_name} and run ID: {run_id}")
        except MlflowException as e:
            print(f"Error registering model: {str(e)}")
            result = None

        return result

    def transition_model_stage(self, version: int, stage: str):
        """
        Transition a model version to a different stage.
        """
        try:
            client = mlflow.tracking.MlflowClient()
            client.transition_model_version_stage(
                self.model_name,
                version,
                stage
            )
            print(f"Transitioning model '{self.model_name}' to stage: {stage}")
        except MlflowException as e:
            print(f"Error transitioning model to stage '{stage}': {str(e)}")

    def fetch_latest_model(self, stage: str = "None"):
        """
        Fetch the latest model for a given stage.
        """
        try:
            client = mlflow.tracking.MlflowClient()
            model_versions = client.search_model_versions(f"name='{self.model_name}'")

            for version in model_versions:
                if version.current_stage == stage:
                    print(f"Fetching latest model at stage: {stage}")
                    return mlflow.sklearn.load_model(f"models:/{self.model_name}/{version.version}")

            print(f"No model found at stage: {stage}")
            return None

        except MlflowException as e:
            print(f"Error fetching model at stage '{stage}': {str(e)}")
            return None

